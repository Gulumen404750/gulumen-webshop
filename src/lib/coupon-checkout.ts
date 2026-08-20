/**
 * DB kupon validálás checkout során + usedCount növelés sikeres fizetés után.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import type { CouponDiscount } from '@/lib/checkout'
import { capCombinedCouponPercent, isFixedCouponDiscount } from '@/lib/coupon-config'
import {
  isAbandonedCartSource,
  parseEligibleItems,
  type AbandonedCartEligibleItem,
} from '@/lib/abandoned-cart-offer'
import { Prisma } from '@prisma/client'
import {
  claimCouponForUser,
  isOwnerlessCoupon,
  isUsageAutoDisabled,
} from '@/lib/coupon-claim'

export type ResolvedDbCoupon = {
  id: string
  code: string
  discountType: string
  discountValue: number
  source: string | null
  userId: string | null
  eligibleItems: AbandonedCartEligibleItem[]
}

export type ResolveCheckoutCouponResult =
  | { ok: true; coupon: ResolvedDbCoupon; discount: CouponDiscount }
  | { ok: false; error: string; code: string }

export function dbCouponToDiscount(coupon: {
  discountType: string
  discountValue: number
}): CouponDiscount {
  if (coupon.discountType === 'fixed') {
    return { fixedHuf: coupon.discountValue }
  }
  return { percent: capCombinedCouponPercent(coupon.discountValue / 100) }
}

export function isCouponInValidPeriod(
  coupon: { validFrom: Date | null; validUntil: Date | null },
  now: Date
): boolean {
  if (coupon.validFrom && now < coupon.validFrom) return false
  if (coupon.validUntil && now > coupon.validUntil) return false
  return true
}

const OWNER_SOURCES = new Set(['gamification', 'registration', 'abandoned_cart', 'birthday'])

export type CouponRedeemPreview = {
  id: string
  code: string
  discountType: string
  discountValue: number
  minOrderHuf: number | null
  validUntil: Date | null
  source: string | null
  userId: string | null
  eligibleItems: AbandonedCartEligibleItem[]
}

/** Kuponkód előnézet (min. rendelés nélkül) – profil / kódbeváltó. */
export async function previewCouponCode(params: {
  couponCode: string
  userId: string | null
  now?: Date
}): Promise<{ ok: true; coupon: CouponRedeemPreview } | { ok: false; error: string; code: string }> {
  if (!isDbConfigured()) {
    return { ok: false, error: 'Coupon checkout requires database', code: 'coupon_unavailable' }
  }

  const code = params.couponCode.trim().toUpperCase().replace(/\s+/g, '')
  if (!code) {
    return { ok: false, error: 'Invalid coupon code', code: 'coupon_invalid' }
  }

  const now = params.now ?? new Date()
  const coupon = await prisma.coupon.findUnique({ where: { code } })
  if (!coupon) {
    return { ok: false, error: 'Coupon not found', code: 'coupon_invalid' }
  }

  if (coupon.consumed) {
    return { ok: false, error: 'Coupon usage limit reached', code: 'coupon_exhausted' }
  }

  if (!coupon.active) {
    const campaignAutoOff = isOwnerlessCoupon(coupon) && isUsageAutoDisabled(coupon)
    if (!campaignAutoOff) {
      return { ok: false, error: 'Coupon is not active', code: 'coupon_inactive' }
    }
  }

  if (!isCouponInValidPeriod(coupon, now)) {
    return { ok: false, error: 'Coupon is outside its validity period', code: 'coupon_expired' }
  }

  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses && !isOwnerlessCoupon(coupon)) {
    return { ok: false, error: 'Coupon usage limit reached', code: 'coupon_exhausted' }
  }

  if (coupon.userId && OWNER_SOURCES.has(coupon.source ?? '')) {
    if (!params.userId) {
      return { ok: false, error: 'Login required for this coupon', code: 'coupon_login_required' }
    }
    if (coupon.userId !== params.userId) {
      return { ok: false, error: 'Coupon does not belong to this account', code: 'coupon_not_owned' }
    }
  }

  return {
    ok: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderHuf: coupon.minOrderHuf,
      validUntil: coupon.validUntil,
      source: coupon.source,
      userId: coupon.userId,
      eligibleItems: parseEligibleItems(coupon.eligibleItems),
    },
  }
}

/** DB kupon keresés és validálás. A fix Ft kupon összevonható egy százalékos kuponnal. */
export async function resolveCheckoutCoupon(params: {
  couponCode: string
  checkoutUserId: string | null
  subtotalHuf: number
  now?: Date
}): Promise<ResolveCheckoutCouponResult> {
  if (!isDbConfigured()) {
    return { ok: false, error: 'Coupon checkout requires database', code: 'coupon_unavailable' }
  }

  const code = params.couponCode.trim().toUpperCase()
  if (!code) {
    return { ok: false, error: 'Invalid coupon code', code: 'coupon_invalid' }
  }

  const preview = await previewCouponCode({
    couponCode: code,
    userId: params.checkoutUserId,
    now: params.now,
  })
  if (!preview.ok) return preview

  let resolved: ResolvedDbCoupon = {
    id: preview.coupon.id,
    code: preview.coupon.code,
    discountType: preview.coupon.discountType,
    discountValue: preview.coupon.discountValue,
    source: preview.coupon.source,
    userId: preview.coupon.userId,
    eligibleItems: preview.coupon.eligibleItems,
  }

  if (!preview.coupon.userId) {
    const claimed = await claimCouponForUser({
      userId: params.checkoutUserId,
      code: preview.coupon.code,
      now: params.now,
      allowExistingUnused: true,
    })
    if (!claimed.ok) {
      return { ok: false, error: claimed.error, code: claimed.code }
    }
    resolved = {
      id: claimed.coupon.id,
      code: claimed.coupon.checkoutCode,
      discountType: claimed.coupon.discountType,
      discountValue: claimed.coupon.discountValue,
      source: claimed.coupon.source,
      userId: claimed.coupon.userId,
      eligibleItems: preview.coupon.eligibleItems,
    }
  }

  if (preview.coupon.minOrderHuf != null && params.subtotalHuf < preview.coupon.minOrderHuf) {
    return {
      ok: false,
      error: `Minimum order amount is ${preview.coupon.minOrderHuf} HUF`,
      code: 'coupon_min_order',
    }
  }

  return { ok: true, coupon: resolved, discount: dbCouponToDiscount(resolved) }
}

export type AbandonedCartCheckoutOffer = {
  percent: number
  eligibleItems: AbandonedCartEligibleItem[]
  couponId: string
}

export type ResolvedCheckoutCoupons = {
  coupons: Array<{ coupon: ResolvedDbCoupon; discount: CouponDiscount }>
  percent: number
  fixedHuf: number
  primaryCouponId: string | null
  secondaryCouponId: string | null
  abandonedCart: AbandonedCartCheckoutOffer | null
}

/**
 * Egy vagy két DB kupon: egy fix Ft + egy százalékos összevonható.
 * Elhagyott kosár (scoped eligibleItems) + egy másik % kupon a többlet/új tételekre megengedett.
 * Két sima százalékos vagy két fix kupon továbbra is tilos.
 */
export function isScopedAbandonedCoupon(entry: {
  coupon: Pick<ResolvedDbCoupon, 'source' | 'eligibleItems'>
  discount: CouponDiscount
}): boolean {
  return (
    isAbandonedCartSource(entry.coupon.source) &&
    entry.coupon.eligibleItems.length > 0 &&
    !isFixedCouponDiscount(entry.discount)
  )
}

export function mergeResolvedCheckoutCoupons(
  resolved: Array<{ coupon: ResolvedDbCoupon; discount: CouponDiscount }>
):
  | { ok: true; result: ResolvedCheckoutCoupons }
  | { ok: false; error: string; code: string } {
  const abandoned = resolved.filter((r) => isScopedAbandonedCoupon(r))
  const others = resolved.filter((r) => !isScopedAbandonedCoupon(r))
  if (abandoned.length > 1) {
    return { ok: false, error: 'Coupons cannot be combined', code: 'coupon_stack_disabled' }
  }

  const fixed = others.filter((r) => isFixedCouponDiscount(r.discount))
  const percent = others.filter((r) => !isFixedCouponDiscount(r.discount))
  if (fixed.length > 1 || percent.length > 1) {
    return { ok: false, error: 'Coupons cannot be combined', code: 'coupon_stack_disabled' }
  }

  const abandonedEntry = abandoned[0] ?? null
  const extra = fixed[0] ?? percent[0] ?? null
  const primary = abandonedEntry ?? extra
  const secondary =
    primary && extra && extra.coupon.id !== primary.coupon.id ? extra : null

  const abandonedPercent = abandonedEntry
    ? capCombinedCouponPercent((abandonedEntry.discount.percent ?? 0) || abandonedEntry.coupon.discountValue / 100)
    : 0

  return {
    ok: true,
    result: {
      coupons: resolved,
      percent: percent[0]?.discount.percent ?? 0,
      fixedHuf: fixed[0]?.discount.fixedHuf ?? 0,
      primaryCouponId: primary?.coupon.id ?? null,
      secondaryCouponId: secondary?.coupon.id ?? null,
      abandonedCart: abandonedEntry
        ? {
            percent: abandonedPercent,
            eligibleItems: abandonedEntry.coupon.eligibleItems,
            couponId: abandonedEntry.coupon.id,
          }
        : null,
    },
  }
}

export async function resolveCheckoutCoupons(params: {
  couponCodes: string[]
  checkoutUserId: string | null
  subtotalHuf: number
  now?: Date
}): Promise<
  | { ok: true; result: ResolvedCheckoutCoupons }
  | { ok: false; error: string; code: string }
> {
  const unique: string[] = []
  for (const raw of params.couponCodes) {
    const code = raw.trim().toUpperCase()
    if (!code || unique.includes(code)) continue
    unique.push(code)
    if (unique.length >= 2) break
  }

  const resolved: Array<{ coupon: ResolvedDbCoupon; discount: CouponDiscount }> = []
  for (const code of unique) {
    const one = await resolveCheckoutCoupon({
      couponCode: code,
      checkoutUserId: params.checkoutUserId,
      subtotalHuf: params.subtotalHuf,
      now: params.now,
    })
    if (!one.ok) return one
    resolved.push({ coupon: one.coupon, discount: one.discount })
  }

  return mergeResolvedCheckoutCoupons(resolved)
}

const PAID_STATUSES = new Set(['paid', 'sourcing_pending'])

async function markCouponConsumedOnPayment(
  tx: Prisma.TransactionClient,
  couponId: string
): Promise<void> {
  const coupon = await tx.coupon.findUnique({ where: { id: couponId } })
  if (!coupon) return
  if (coupon.consumed) return

  const alreadyExhausted = coupon.maxUses != null && coupon.usedCount >= coupon.maxUses
  const isFixed = coupon.discountType === 'fixed'
  const newUsedCount = alreadyExhausted ? coupon.usedCount : coupon.usedCount + 1
  const exhausted = coupon.maxUses != null && newUsedCount >= coupon.maxUses
  const fullyConsumed = isFixed || exhausted || (coupon.maxUses ?? 1) <= newUsedCount
  await tx.coupon.update({
    where: { id: coupon.id },
    data: {
      usedCount: newUsedCount,
      ...(fullyConsumed
        ? {
            consumed: true,
            ...(isFixed || exhausted ? { active: false } : {}),
          }
        : {}),
    },
  })
}

/**
 * Sikeres fizetés után: usedCount +1, egyszer rendelés-csoportonként.
 * Capture (paid) és authorize (sourcing_pending) esetén is meghívandó.
 * Fix Ft kupon: a fel nem használt maradék nem íródik jóvá, nem kerül egyenlegre,
 * a kupon consumed = true (teljes névérték felemésztve).
 */
export async function recordCouponUsageOnPayment(orderId: string): Promise<void> {
  if (!isDbConfigured()) return

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      couponId: true,
      secondaryCouponId: true,
      orderGroupId: true,
      couponUsageRecorded: true,
      status: true,
    },
  })
  if (!order) return
  if ((!order.couponId && !order.secondaryCouponId) || order.couponUsageRecorded) return
  if (!PAID_STATUSES.has(order.status)) return

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        couponId: true,
        secondaryCouponId: true,
        orderGroupId: true,
        couponUsageRecorded: true,
        status: true,
      },
    })
    if (!fresh || fresh.couponUsageRecorded) return
    if (!PAID_STATUSES.has(fresh.status)) return
    if (!fresh.couponId && !fresh.secondaryCouponId) return

    if (fresh.orderGroupId) {
      const alreadyRecorded = await tx.order.findFirst({
        where: {
          orderGroupId: fresh.orderGroupId,
          couponUsageRecorded: true,
        },
      })
      if (alreadyRecorded) {
        await tx.order.updateMany({
          where: { orderGroupId: fresh.orderGroupId },
          data: { couponUsageRecorded: true },
        })
        return
      }
    }

    const ids = [fresh.couponId, fresh.secondaryCouponId].filter((id): id is string => Boolean(id))
    for (const id of ids) {
      await markCouponConsumedOnPayment(tx, id)
    }

    if (fresh.orderGroupId) {
      await tx.order.updateMany({
        where: { orderGroupId: fresh.orderGroupId },
        data: { couponUsageRecorded: true },
      })
    } else {
      await tx.order.update({
        where: { id: orderId },
        data: { couponUsageRecorded: true },
      })
    }
  })
}
