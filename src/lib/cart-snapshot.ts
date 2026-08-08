import { prisma, isDbConfigured } from '@/lib/prisma'
import type { CartItem } from '@/lib/cart-storage'

export const ABANDONED_CART_DAYS = 7
export const ABANDONED_CART_OFFER_VALID_DAYS = 14
export const ABANDONED_CART_OFFER_PERCENTS = [10, 15, 20, 25] as const

export type AbandonedCartOfferPercent = (typeof ABANDONED_CART_OFFER_PERCENTS)[number]

export type CartSnapshotLine = {
  productId: string
  qty: number
  options?: CartItem['options']
  name: string
  unitPriceHuf: number
  lineTotalHuf: number
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
  return raw
    .map((x) => {
      const row = x as Record<string, unknown>
      const opts = row.options as Record<string, unknown> | undefined
      return {
        productId: String(row.productId ?? ''),
        qty: Math.max(1, Number(row.qty) || 1),
        options:
          opts && (opts.colorName != null || opts.colorHex != null || opts.materialName != null)
            ? {
                colorName: opts.colorName != null ? String(opts.colorName) : undefined,
                colorHex: opts.colorHex != null ? String(opts.colorHex) : undefined,
                materialName: opts.materialName != null ? String(opts.materialName) : undefined,
              }
            : undefined,
      }
    })
    .filter((x) => x.productId !== '')
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
        select: { id: true, name: true, priceHuf: true, discountPriceHuf: true },
      })
    : []
  const byId = new Map(products.map((p) => [p.id, p]))

  const lines: CartSnapshotLine[] = []
  let itemCount = 0
  let subtotalHuf = 0

  for (const item of items) {
    const p = byId.get(item.productId)
    const unitPriceHuf = p ? (p.discountPriceHuf ?? p.priceHuf) : 0
    const lineTotalHuf = unitPriceHuf * item.qty
    itemCount += item.qty
    subtotalHuf += lineTotalHuf
    lines.push({
      productId: item.productId,
      qty: item.qty,
      options: item.options,
      name: p?.name ?? item.productId,
      unitPriceHuf,
      lineTotalHuf,
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

export async function clearUserCartSnapshot(userId: string): Promise<void> {
  if (!isDbConfigured()) return
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
    },
  })

  await prisma.userCartSnapshot.update({
    where: { userId },
    data: {
      lastOfferAt: now,
      lastOfferPercent: percent,
      lastOfferCouponId: coupon.id,
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

  const { sendAbandonedCartReminderEmail } = await import('@/lib/abandoned-cart-email')
  const emailResult = await sendAbandonedCartReminderEmail({
    to: snapshot.user.email,
    name: snapshot.user.name,
    lines,
    subtotalHuf,
  })

  if (!emailResult.ok) {
    return { ok: false, error: emailResult.error }
  }

  return { ok: true, emailSent: true, to: snapshot.user.email }
}
