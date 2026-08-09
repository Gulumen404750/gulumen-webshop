import { isDbConfigured } from '@/lib/prisma'
import { enqueuePointEvent, processPendingPointEvents } from './point-event-queue'
import { LUCKY_SPIN_POINTS_BONUS_PERCENT, POINT_TX_TYPES } from './constants'

type OrderPointsPayload = {
  id: string
  userId?: string | null
  pointsUsed: number
  pointsDiscountHuf: number
}

/** Sikeres fizetés után: pontlevonás outbox-on keresztül. */
export async function enqueueOrderPurchasePointsRedemption(
  order: OrderPointsPayload
): Promise<void> {
  if (!isDbConfigured()) return
  if (!order.userId || !order.pointsUsed || order.pointsUsed <= 0) return

  const { enqueued } = await enqueuePointEvent({
    userId: order.userId,
    type: 'PURCHASE_REDEEM',
    idempotencyKey: `event:purchase-redeem:${order.id}`,
    payload: {
      orderId: order.id,
      pointsUsed: order.pointsUsed,
      pointsDiscountHuf: order.pointsDiscountHuf,
    },
  })

  if (enqueued) {
    await processPendingPointEvents(5, order.userId)
  }
}

/** Szerencsekerék akció: +5% bónuszpont a felhasznált pontok után. */
export async function enqueueLuckySpinPointsBonus(input: {
  orderId: string
  userId: string
  pointsUsed: number
}): Promise<void> {
  if (!isDbConfigured()) return
  if (!input.pointsUsed || input.pointsUsed <= 0) return

  const bonusPoints = Math.floor(input.pointsUsed * LUCKY_SPIN_POINTS_BONUS_PERCENT)
  if (bonusPoints <= 0) return

  const { enqueued } = await enqueuePointEvent({
    userId: input.userId,
    type: POINT_TX_TYPES.LUCKY_SPIN_BONUS,
    idempotencyKey: `event:lucky-spin-bonus:${input.orderId}`,
    payload: {
      orderId: input.orderId,
      pointsUsed: input.pointsUsed,
      bonusPoints,
    },
  })

  if (enqueued) {
    await processPendingPointEvents(5, input.userId)
  }
}
