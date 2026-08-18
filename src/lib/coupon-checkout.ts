/**
 * DB kupon validálás checkout során + usedCount növelés sikeres fizetés után.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import type { CouponDiscount } from '@/lib/checkout'
import { capCombinedCouponPercent } from '@/lib/coupon-config'

export type ResolvedDbCoupon = {
  id: string
  code: string
  discountType: string
  discountValue: number
  source: string | null
  userId: string | null
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

function isCouponInValidPeriod(
  coupon: { validFrom: Date | null; validUntil: Date | null },
  now: Date
): boolean {
  if (coupon.validFrom && now < coupon.validFrom) return false
  if (coupon.validUntil && now > coupon.validUntil) return false
  return true
}

/** DB kupon keresés és validálás – nem kombinálható loyalty / macska kuponnal. */
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

  const now = params.now ?? new Date()
  const coupon = await prisma.coupon.findUnique({ where: { code } })
  if (!coupon) {
    return { ok: false, error: 'Coupon not found', code: 'coupon_invalid' }
  }

  if (!coupon.active) {
    return { ok: false, error: 'Coupon is not active', code: 'coupon_inactive' }
  }

  if (!isCouponInValidPeriod(coupon, now)) {
    return { ok: false, error: 'Coupon is outside its validity period', code: 'coupon_expired' }
  }

  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: 'Coupon usage limit reached', code: 'coupon_exhausted' }
  }

  if (coupon.minOrderHuf != null && params.subtotalHuf < coupon.minOrderHuf) {
    return {
      ok: false,
      error: `Minimum order amount is ${coupon.minOrderHuf} HUF`,
      code: 'coupon_min_order',
    }
  }

  const ownerSources = new Set(['gamification', 'registration', 'abandoned_cart', 'birthday'])
  if (coupon.userId && ownerSources.has(coupon.source ?? '')) {
    if (!params.checkoutUserId) {
      return { ok: false, error: 'Login required for this coupon', code: 'coupon_login_required' }
    }
    if (coupon.userId !== params.checkoutUserId) {
      return { ok: false, error: 'Coupon does not belong to this account', code: 'coupon_not_owned' }
    }
  }

  const resolved: ResolvedDbCoupon = {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    source: coupon.source,
    userId: coupon.userId,
  }

  return { ok: true, coupon: resolved, discount: dbCouponToDiscount(resolved) }
}

const PAID_STATUSES = new Set(['paid', 'sourcing_pending'])

/**
 * Sikeres fizetés után: usedCount +1, egyszer rendelés-csoportonként.
 * Capture (paid) és authorize (sourcing_pending) esetén is meghívandó.
 */
export async function recordCouponUsageOnPayment(orderId: string): Promise<void> {
  if (!isDbConfigured()) return

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, couponId: true, orderGroupId: true, couponUsageRecorded: true, status: true },
  })
  if (!order?.couponId || order.couponUsageRecorded) return
  if (!PAID_STATUSES.has(order.status)) return

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({
      where: { id: orderId },
      select: { couponId: true, orderGroupId: true, couponUsageRecorded: true, status: true },
    })
    if (!fresh?.couponId || fresh.couponUsageRecorded) return
    if (!PAID_STATUSES.has(fresh.status)) return

    if (fresh.orderGroupId) {
      const alreadyRecorded = await tx.order.findFirst({
        where: {
          orderGroupId: fresh.orderGroupId,
          couponId: fresh.couponId,
          couponUsageRecorded: true,
        },
      })
      if (alreadyRecorded) {
        await tx.order.updateMany({
          where: { orderGroupId: fresh.orderGroupId, couponId: fresh.couponId },
          data: { couponUsageRecorded: true },
        })
        return
      }
    }

    const coupon = await tx.coupon.findUnique({ where: { id: fresh.couponId } })
    if (!coupon) return
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return

    const newUsedCount = coupon.usedCount + 1
    await tx.coupon.update({
      where: { id: coupon.id },
      data: {
        usedCount: newUsedCount,
        ...(coupon.maxUses != null && newUsedCount >= coupon.maxUses ? { active: false } : {}),
      },
    })

    if (fresh.orderGroupId) {
      await tx.order.updateMany({
        where: { orderGroupId: fresh.orderGroupId, couponId: fresh.couponId },
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
