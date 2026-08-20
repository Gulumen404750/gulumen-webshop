import { prisma, isDbConfigured } from '@/lib/prisma'
import { normalizeCartItem, type CartItem } from '@/lib/cart-storage'
import { absoluteFirstPartyProductImages } from '@/lib/product-image-urls'
import { eligibleItemsFromCart, parseEligibleItems } from '@/lib/abandoned-cart-offer'
import {
  abandonedCartRestoreUrl,
  generateRestoreToken,
  hashRestoreToken,
  isLikelyRestoreToken,
} from '@/lib/abandoned-cart-restore'
import { isCouponInValidPeriod } from '@/lib/coupon-checkout'

export const ABANDONED_CART_DAYS = 7
export const ABANDONED_CART_OFFER_VALID_DAYS = 14
export const ABANDONED_CART_OFFER_PERCENTS = [10, 15] as const

export type AbandonedCartOfferPercent = (typeof ABANDONED_CART_OFFER_PERCENTS)[number]

export type CartSnapshotLine = {
  productId: string
  qty: number
  options?: CartItem['options']
  name: string
  unitPriceHuf: number
  lineTotalHuf: number
  image?: string
}

export type AdminCartSnapshotRow = {
  userId: string
  email: string
  name: string | null
  /** Marketing / hírlevél hozzájárulás – remarketinghez kötelező. */
  marketingOptIn: boolean
  itemCount: number
  subtotalHuf: number
  lines: CartSnapshotLine[]
  lastUpdatedAt: string
  daysSinceUpdate: number
  isAbandoned: boolean
  purchasedSinceUpdate: boolean
  lastOfferAt: string | null
  lastOfferPercent: number | null
  lastOfferCouponCode: string | null
}

function parseItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeCartItem).filter((x): x is CartItem => x != null)
}

async function computeLines(items: CartItem[]): Promise<{
  lines: CartSnapshotLine[]
  itemCount: number
  subtotalHuf: number
}> {
  const productIds = [...new Set(items.map((i) => i.productId))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, priceHuf: true, discountPriceHuf: true, image: true, images: true },
      })
    : []
  const byId = new Map(products.map((p) => [p.id, p]))

  const lines: CartSnapshotLine[] = []
  let itemCount = 0
  let subtotalHuf = 0

  for (const item of items) {
    const p = byId.get(item.productId)
    const livePrice = p ? (p.discountPriceHuf ?? p.priceHuf) : undefined
    const unitPriceHuf =
      livePrice != null && livePrice > 0
        ? livePrice
        : item.priceHuf != null && item.priceHuf > 0
          ? item.priceHuf
          : livePrice ?? 0
    const lineTotalHuf = unitPriceHuf * item.qty
    itemCount += item.qty
    subtotalHuf += lineTotalHuf
    const image = p ? absoluteFirstPartyProductImages(p, 1)[0] : undefined
    lines.push({
      productId: item.productId,
      qty: item.qty,
      options: item.options,
      name: (p?.name || item.name || item.productId).trim(),
      unitPriceHuf,
      lineTotalHuf,
      ...(image ? { image } : {}),
    })
  }

  return { lines, itemCount, subtotalHuf }
}

export async function upsertUserCartSnapshot(userId: string, items: CartItem[]): Promise<void> {
  if (!isDbConfigured()) return
  if (items.length === 0) {
    await clearUserCartSnapshot(userId)
    return
  }

  const { itemCount, subtotalHuf } = await computeLines(items)
  await prisma.userCartSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      items: items as object,
      itemCount,
      subtotalHuf,
    },
    update: {
      items: items as object,
      itemCount,
      subtotalHuf,
    },
  })
}

export async function clearUserCartSnapshot(
  userId: string,
  options?: { force?: boolean }
): Promise<void> {
  if (!isDbConfigured()) return
  if (!options?.force) {
    const row = await prisma.userCartSnapshot.findUnique({
      where: { userId },
      select: { restoreTokenHash: true, restoreExpiresAt: true },
    })
    if (
      row?.restoreTokenHash &&
      row.restoreExpiresAt &&
      row.restoreExpiresAt.getTime() > Date.now()
    ) {
      await prisma.userCartSnapshot.update({
        where: { userId },
        data: { items: [], itemCount: 0, subtotalHuf: 0 },
      })
      return
    }
  }
  await prisma.userCartSnapshot.deleteMany({ where: { userId } })
}

async function userPurchasedSince(userId: string, since: Date): Promise<boolean> {
  const paid = await prisma.order.findFirst({
    where: {
      userId,
      createdAt: { gt: since },
      status: { in: ['paid', 'sourcing_pending', 'fulfilled'] },
    },
    select: { id: true },
  })
  return Boolean(paid)
}

export async function listAdminCartSnapshots(options?: {
  abandonedOnly?: boolean
  /** Csak marketingOptIn=true userek (remarketing lista). */
  marketingSubscribedOnly?: boolean
  limit?: number
}): Promise<AdminCartSnapshotRow[]> {
  if (!isDbConfigured()) return []

  const limit = options?.limit ?? 200
  const now = Date.now()

  const rows = await prisma.userCartSnapshot.findMany({
    where: {
      itemCount: { gt: 0 },
      ...(options?.marketingSubscribedOnly
        ? { user: { marketingOptIn: true } }
        : {}),
    },
    orderBy: { lastUpdatedAt: 'asc' },
    take: limit,
    include: {
      user: {
        select: { id: true, email: true, name: true, marketingOptIn: true },
      },
    },
  })

  const couponIds = rows.map((r) => r.lastOfferCouponId).filter(Boolean) as string[]
  const coupons =
    couponIds.length > 0
      ? await prisma.coupon.findMany({
          where: { id: { in: couponIds } },
          select: { id: true, code: true },
        })
      : []
  const codeById = new Map(coupons.map((c) => [c.id, c.code]))

  const result: AdminCartSnapshotRow[] = []

  for (const row of rows) {
    const items = parseItems(row.items)
    const { lines, itemCount, subtotalHuf } = await computeLines(items)
    const daysSinceUpdate = Math.floor((now - row.lastUpdatedAt.getTime()) / (24 * 60 * 60 * 1000))
    const purchasedSinceUpdate = await userPurchasedSince(row.userId, row.lastUpdatedAt)
    const isAbandoned =
      daysSinceUpdate >= ABANDONED_CART_DAYS && !purchasedSinceUpdate && itemCount > 0

    if (options?.abandonedOnly && !isAbandoned) continue

    result.push({
      userId: row.userId,
      email: row.user.email,
      name: row.user.name,
      marketingOptIn: row.user.marketingOptIn,
      itemCount,
      subtotalHuf,
      lines,
      lastUpdatedAt: row.lastUpdatedAt.toISOString(),
      daysSinceUpdate,
      isAbandoned,
      purchasedSinceUpdate,
      lastOfferAt: row.lastOfferAt?.toISOString() ?? null,
      lastOfferPercent: row.lastOfferPercent,
      lastOfferCouponCode: row.lastOfferCouponId
        ? codeById.get(row.lastOfferCouponId) ?? null
        : null,
    })
  }

  return result
}

function randomCouponSuffix(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function sendAbandonedCartOffer(
  userId: string,
  percent: AbandonedCartOfferPercent
): Promise<
  | { ok: true; couponCode: string; emailSent: boolean; emailError?: string }
  | { ok: false; error: string }
> {
  if (!isDbConfigured()) {
    return { ok: false, error: 'Database not configured' }
  }

  if (!ABANDONED_CART_OFFER_PERCENTS.includes(percent)) {
    return { ok: false, error: 'Invalid discount percent' }
  }

  const snapshot = await prisma.userCartSnapshot.findUnique({
    where: { userId },
    include: {
      user: { select: { email: true, name: true, marketingOptIn: true } },
    },
  })
  if (!snapshot || snapshot.itemCount <= 0) {
    return { ok: false, error: 'No cart snapshot for user' }
  }
  if (!snapshot.user.email?.trim()) {
    return { ok: false, error: 'Nincs e-mail cím ehhez a kosárhoz' }
  }
  if (!snapshot.user.marketingOptIn) {
    return {
      ok: false,
      error:
        'Nincs marketing hozzájárulás – kedvezmény ajánlat e-mail nem küldhető (GDPR).',
    }
  }
  if (await userPurchasedSince(userId, snapshot.lastUpdatedAt)) {
    return { ok: false, error: 'A vásárló már vásárolt a kosár frissítése óta' }
  }

  const items = parseItems(snapshot.items)
  const { lines, subtotalHuf } = await computeLines(items)
  const now = new Date()
  const validUntil = new Date(now.getTime() + ABANDONED_CART_OFFER_VALID_DAYS * 24 * 60 * 60 * 1000)

  let code = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    code = `KOSAR-${percent}-${randomCouponSuffix()}`
    const exists = await prisma.coupon.findUnique({ where: { code } })
    if (!exists) break
  }

  const coupon = await prisma.coupon.create({
    data: {
      code,
      discountType: 'percent',
      discountValue: percent,
      active: true,
      maxUses: 1,
      userId,
      source: 'abandoned_cart',
      validUntil,
      eligibleItems: eligibleItemsFromCart(items),
    },
  })

  const { token: restoreToken, hash: restoreTokenHash } = generateRestoreToken()
  await prisma.userCartSnapshot.update({
    where: { userId },
    data: {
      lastOfferAt: now,
      lastOfferPercent: percent,
      lastOfferCouponId: coupon.id,
      restoreTokenHash,
      frozenItems: items as object,
      restoreExpiresAt: validUntil,
    },
  })

  const { sendAbandonedCartOfferEmail } = await import('@/lib/abandoned-cart-email')
  const emailResult = await sendAbandonedCartOfferEmail({
    to: snapshot.user.email,
    name: snapshot.user.name,
    percent,
    couponCode: code,
    validUntil,
    lines,
    subtotalHuf,
    restoreUrl: abandonedCartRestoreUrl(restoreToken),
  })

  return {
    ok: true,
    couponCode: code,
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? undefined : emailResult.error,
  }
}

/** Alap emlékeztető e-mail kupon nélkül a kosár e-mail címére. */
export async function sendAbandonedCartReminder(
  userId: string
): Promise<{ ok: true; emailSent: boolean; to: string } | { ok: false; error: string }> {
  if (!isDbConfigured()) {
    return { ok: false, error: 'Database not configured' }
  }

  const snapshot = await prisma.userCartSnapshot.findUnique({
    where: { userId },
    include: {
      user: { select: { email: true, name: true, marketingOptIn: true } },
    },
  })
  if (!snapshot || snapshot.itemCount <= 0) {
    return { ok: false, error: 'No cart snapshot for user' }
  }
  if (!snapshot.user.email?.trim()) {
    return { ok: false, error: 'Nincs e-mail cím ehhez a kosárhoz' }
  }
  if (!snapshot.user.marketingOptIn) {
    return {
      ok: false,
      error:
        'Nincs marketing hozzájárulás – elhagyott kosár emlékeztető nem küldhető (GDPR).',
    }
  }

  const purchased = await userPurchasedSince(userId, snapshot.lastUpdatedAt)
  if (purchased) {
    return { ok: false, error: 'A vásárló már vásárolt a kosár frissítése óta' }
  }

  const items = parseItems(snapshot.items)
  const { lines, subtotalHuf } = await computeLines(items)
  const restoreExpiresAt = new Date(
    Date.now() + ABANDONED_CART_OFFER_VALID_DAYS * 24 * 60 * 60 * 1000
  )
  const { token: restoreToken, hash: restoreTokenHash } = generateRestoreToken()
  await prisma.userCartSnapshot.update({
    where: { userId },
    data: {
      restoreTokenHash,
      frozenItems: items as object,
      restoreExpiresAt,
    },
  })

  const { sendAbandonedCartReminderEmail } = await import('@/lib/abandoned-cart-email')
  const emailResult = await sendAbandonedCartReminderEmail({
    to: snapshot.user.email,
    name: snapshot.user.name,
    lines,
    subtotalHuf,
    restoreUrl: abandonedCartRestoreUrl(restoreToken),
  })

  if (!emailResult.ok) {
    return { ok: false, error: emailResult.error }
  }

  return { ok: true, emailSent: true, to: snapshot.user.email }
}

export type AbandonedCartRestoreCoupon = {
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderHuf: number | null
  source: string
  eligibleItems: ReturnType<typeof parseEligibleItems>
  validUntil: string | null
}

export type AbandonedCartRestorePayload =
  | { ok: true; items: CartItem[]; coupon: AbandonedCartRestoreCoupon | null }
  | { ok: false; code: 'invalid' | 'expired' }

export async function loadAbandonedCartByRestoreToken(
  token: string
): Promise<AbandonedCartRestorePayload> {
  if (!isDbConfigured() || !isLikelyRestoreToken(token)) {
    return { ok: false, code: 'invalid' }
  }

  const hash = hashRestoreToken(token)
  const snapshot = await prisma.userCartSnapshot.findUnique({
    where: { restoreTokenHash: hash },
  })
  if (!snapshot) return { ok: false, code: 'invalid' }

  const now = Date.now()
  if (snapshot.restoreExpiresAt && snapshot.restoreExpiresAt.getTime() < now) {
    return { ok: false, code: 'expired' }
  }

  const frozen = parseItems(snapshot.frozenItems)
  const live = parseItems(snapshot.items)
  const items = frozen.length > 0 ? frozen : live
  if (items.length === 0) return { ok: false, code: 'expired' }

  let coupon: AbandonedCartRestoreCoupon | null = null
  if (snapshot.lastOfferCouponId) {
    const row = await prisma.coupon.findUnique({
      where: { id: snapshot.lastOfferCouponId },
    })
    if (
      row &&
      row.active &&
      !row.consumed &&
      isCouponInValidPeriod(row, new Date()) &&
      (row.maxUses == null || row.usedCount < row.maxUses)
    ) {
      coupon = {
        code: row.code,
        discountType: row.discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue: row.discountValue,
        minOrderHuf: row.minOrderHuf,
        source: row.source || 'abandoned_cart',
        eligibleItems: parseEligibleItems(row.eligibleItems),
        validUntil: row.validUntil?.toISOString() ?? null,
      }
    }
  }

  return { ok: true, items, coupon }
}

