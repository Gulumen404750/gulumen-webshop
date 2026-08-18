import { isDbConfigured } from '@/lib/prisma'
import { enqueuePointEvent, processPendingPointEvents } from './point-event-queue'

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

/** Szerencsekerék akció: +5% most checkout kedvezmény, ne írjunk vissza pontot. */
export async function enqueueLuckySpinPointsBonus(_input: {
  orderId: string
  userId: string
  pointsUsed: number
}): Promise<void> {
  return
}
