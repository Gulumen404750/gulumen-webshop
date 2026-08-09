/**
 * Sikeres fizetés után: kiválasztott kuponok érvénytelenítése + hűségpontok levonása.
 * Idempotens – webhook és siker oldal is hívhatja.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import { recordCouponUsageOnPayment } from '@/lib/coupon-checkout'
import { markUserPromoCouponUsed, markUserPromoCouponsUsed } from '@/lib/promo-coupons'
import { markWelcomeCouponRedeemed } from '@/lib/welcome-checkout-offer'
import { applyPointDelta } from '@/lib/gamification/point-ledger'
import { POINT_TX_TYPES } from '@/lib/gamification/constants'
import { logger } from '@/lib/logger'

export const APPLIED_COUPON_KINDS = [
  'cat',
  'registration',
  'loyalty',
  'welcome',
  'birthday',
] as const

export type AppliedCouponKind = (typeof APPLIED_COUPON_KINDS)[number]

const PAID_LIKE_STATUSES = new Set(['paid', 'sourcing_pending', 'fulfilled'])

export function parseAppliedCoupons(value: unknown): AppliedCouponKind[] {
  if (!Array.isArray(value)) return []
  const out: AppliedCouponKind[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    if ((APPLIED_COUPON_KINDS as readonly string[]).includes(item)) {
      out.push(item as AppliedCouponKind)
    }
  }
  return out
}

export type FinalizeOrderRewardsResult = {
  ok: boolean
  alreadyFinalized?: boolean
  skipped?: boolean
  reason?: string
  burned: {
    dbCoupon: boolean
    promoKinds: AppliedCouponKind[]
    welcome: boolean
    pointsUsed: number
  }
}

/**
 * Rendelés jutalmainak véglegesítése: kuponok used + pontlevonás.
 * Csak paid / sourcing_pending / fulfilled státusznál fut.
 */
export async function finalizeOrderRewards(orderId: string): Promise<FinalizeOrderRewardsResult> {
  const emptyBurn = {
    dbCoupon: false,
    promoKinds: [] as AppliedCouponKind[],
    welcome: false,
    pointsUsed: 0,
  }

  if (!isDbConfigured()) {
    return { ok: false, skipped: true, reason: 'db_unavailable', burned: emptyBurn }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      userId: true,
      customerEmail: true,
      couponId: true,
      pointsUsed: true,
      pointsDiscountHuf: true,
      appliedCoupons: true,
      rewardsFinalized: true,
      orderGroupId: true,
    },
  })

  if (!order) {
    return { ok: false, skipped: true, reason: 'order_not_found', burned: emptyBurn }
  }

  if (!PAID_LIKE_STATUSES.has(order.status)) {
    return { ok: false, skipped: true, reason: 'order_not_paid', burned: emptyBurn }
  }

  if (order.rewardsFinalized) {
    return { ok: true, alreadyFinalized: true, burned: emptyBurn }
  }

  // Optimistic claim – párhuzamos webhook + siker oldal ne fusson kétszer
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, rewardsFinalized: false },
    data: { rewardsFinalized: true },
  })
  if (claimed.count === 0) {
    return { ok: true, alreadyFinalized: true, burned: emptyBurn }
  }

  const applied = parseAppliedCoupons(order.appliedCoupons)
  const burned: FinalizeOrderRewardsResult['burned'] = {
    dbCoupon: false,
    promoKinds: [],
    welcome: false,
    pointsUsed: 0,
  }

  try {
    // 1) DB kupon (születésnapi / gamification / admin kód)
    if (order.couponId) {
      await recordCouponUsageOnPayment(orderId)
      burned.dbCoupon = true
    }

    // 2) Promo kuponok (cat / registration) – csak a kiválasztottak
    if (order.userId) {
      if (applied.includes('cat')) {
        await markUserPromoCouponUsed(order.userId, 'cat')
        burned.promoKinds.push('cat')
      }
      if (applied.includes('registration')) {
        await markUserPromoCouponUsed(order.userId, 'registration')
        burned.promoKinds.push('registration')
      }
    }

    // Legacy rendelések (appliedCoupons == null): korábbi webhook minden claimed promót égetett.
    if (order.appliedCoupons == null && order.userId) {
      await markUserPromoCouponsUsed(order.userId)
      burned.promoKinds.push('cat', 'registration')
    }

    // 3) Welcome 10% – csak ha ki volt választva (vagy legacy null appliedCoupons)
    const email = order.customerEmail?.trim().toLowerCase() ?? ''
    if (applied.includes('welcome') && email) {
      await markWelcomeCouponRedeemed(email)
      burned.welcome = true
    } else if (order.appliedCoupons == null && email) {
      await markWelcomeCouponRedeemed(email)
      burned.welcome = true
    }

    // 4) Pontlevonás – azonnal, idempotens kulccsal
    const pointsUsed = order.pointsUsed ?? 0
    if (order.userId && pointsUsed > 0) {
      await applyPointDelta({
        userId: order.userId,
        delta: -pointsUsed,
        type: POINT_TX_TYPES.PURCHASE_REDEEM,
        idempotencyKey: `purchase-redeem:${orderId}`,
        reason: 'Pont felhasználás vásárláskor',
        referenceType: 'order',
        referenceId: orderId,
        metadata: {
          orderId,
          pointsUsed,
          pointsDiscountHuf: order.pointsDiscountHuf ?? 0,
        },
      })
      burned.pointsUsed = pointsUsed

      // Ha volt pending outbox esemény, jelöljük késznek (elkerüli a dupla feldolgozást)
      try {
        await prisma.pointEvent.updateMany({
          where: {
            userId: order.userId,
            type: 'PURCHASE_REDEEM',
            idempotencyKey: `event:purchase-redeem:${orderId}`,
            status: { in: ['pending', 'processing'] },
          },
          data: { status: 'completed', processedAt: new Date(), lastError: null },
        })
      } catch {
        /* non-fatal */
      }
    }

    logger.info(
      { orderId, burned, applied },
      'finalizeOrderRewards: coupons burned and points deducted'
    )
    return { ok: true, burned }
  } catch (err) {
    // Claim visszavonása, hogy a webhook / siker oldal újrapróbálhassa
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { rewardsFinalized: false },
      })
    } catch {
      /* ignore */
    }
    logger.error({ err, orderId }, 'finalizeOrderRewards failed')
    throw err
  }
}

/** Rendeléscsoport összes fizetett rendelésére. */
export async function finalizeOrderGroupRewards(orderGroupId: string): Promise<FinalizeOrderRewardsResult[]> {
  if (!isDbConfigured() || !orderGroupId) return []
  const orders = await prisma.order.findMany({
    where: {
      orderGroupId,
      status: { in: [...PAID_LIKE_STATUSES] },
    },
    select: { id: true },
  })
  const results: FinalizeOrderRewardsResult[] = []
  for (const o of orders) {
    results.push(await finalizeOrderRewards(o.id))
  }
  return results
}

/**
 * Dummy / pending checkout + siker oldal:
 * payment_pending rendeléseket lezárja (paid / sourcing_pending), majd éget.
 * Stripe tranzakciónál NEM confirmál – azt a webhook / session.paid intézi
 * (ne lehessen order_group_id-vel fizetés nélkül paid-ra állítani).
 */
export async function confirmPendingAndFinalizeOrderGroup(
  orderGroupId: string
): Promise<FinalizeOrderRewardsResult[]> {
  if (!isDbConfigured() || !orderGroupId) return []

  const orders = await prisma.order.findMany({
    where: { orderGroupId },
    select: { id: true, status: true, orderType: true },
    orderBy: { createdAt: 'asc' },
  })

  const { getPaymentTransactionsByOrderId, updatePaymentTransactionStatus } = await import(
    '@/lib/payment-transactions'
  )

  for (const order of orders) {
    if (order.status !== 'payment_pending') continue

    const txs = getPaymentTransactionsByOrderId(order.id)
    const hasOpenStripeTx = txs.some(
      (tx) =>
        tx.provider === 'stripe' &&
        (tx.status === 'pending' || tx.status === 'created')
    )
    if (hasOpenStripeTx) {
      // Stripe: várjuk a webhookot / session paid-et
      continue
    }

    const nextStatus = order.orderType === 'sourcing' ? 'sourcing_pending' : 'paid'
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        ...(nextStatus === 'paid' ? { paidAt: new Date() } : {}),
      },
    })
    try {
      const { markReservationsPaidByOrderId } = await import('@/lib/reservations')
      await markReservationsPaidByOrderId(order.id)
    } catch {
      /* non-fatal */
    }
    for (const tx of txs) {
      if (tx.status === 'pending' || tx.status === 'created') {
        updatePaymentTransactionStatus(tx.id, 'succeeded')
      }
    }
  }

  return finalizeOrderGroupRewards(orderGroupId)
}
