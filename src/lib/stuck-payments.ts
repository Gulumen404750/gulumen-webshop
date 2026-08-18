/**
 * Elakadt payment_pending rendelések takarítása:
 * - status → cancelled
 * - in_stock készlet visszaírása
 * - sourcing reservation CANCELED
 *
 * Ugyanez a CAS-alapú cancel+restore a payment webhook failed/cancelled ágon is.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { restoreStockAtomic } from '@/lib/inventory'
import { markReservationsCanceledByOrderId } from '@/lib/reservations'
import { logger } from '@/lib/logger'

const DEFAULT_STUCK_AFTER_MS = 45 * 60 * 1000

export type CancelPendingOrderInput = {
  id: string
  orderType?: string | null
  items: { productId: string; qty: number; fulfillmentType: string }[]
}

/**
 * Atomian: payment_pending → cancelled + in_stock készlet visszaírás.
 * Ha a rendelés már nem pending, no-op (dupla webhook / race biztonságos).
 */
export async function cancelPendingOrderWithStockRestore(
  order: CancelPendingOrderInput
): Promise<{ cancelled: boolean; stockRestored: number; reservationsCanceled: number }> {
  if (!isDbConfigured()) {
    return { cancelled: false, stockRestored: 0, reservationsCanceled: 0 }
  }

  let cancelled = false
  let stockRestored = 0
  let reservationsCanceled = 0

  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: 'payment_pending' },
      data: { status: 'cancelled' },
    })
    if (updated.count === 0) return

    cancelled = true

    if (order.orderType === 'in_stock' || !order.orderType) {
      const stockItems = order.items
        .filter((i) => i.fulfillmentType === 'stock')
        .map((i) => ({ productId: i.productId, qty: i.qty }))
      if (stockItems.length > 0) {
        await restoreStockAtomic(stockItems, tx)
        stockRestored = stockItems.reduce((s, i) => s + i.qty, 0)
      }
    }
  })

  if (cancelled && order.orderType === 'sourcing') {
    await markReservationsCanceledByOrderId(order.id)
    reservationsCanceled = 1
  }

  return { cancelled, stockRestored, reservationsCanceled }
}

export type ReleasePendingCheckoutHoldsInput = {
  userId?: string | null
  customerEmail?: string | null
  /** Ha meg van adva, csak ezeket a pending rendeléseket oldja fel. */
  orderIds?: string[]
}

/**
 * Sikertelen Stripe-session vagy újrapróbálás: a vevő payment_pending rendeléseit
 * azonnal cancelled-re teszi, és visszaírja a lefoglalt in_stock készletet.
 */
export async function releasePendingCheckoutHolds(
  options: ReleasePendingCheckoutHoldsInput
): Promise<{ cancelled: number; stockRestored: number; reservationsCanceled: number }> {
  if (!isDbConfigured()) {
    return { cancelled: 0, stockRestored: 0, reservationsCanceled: 0 }
  }

  const orderIds = (options.orderIds ?? []).map((id) => id.trim()).filter(Boolean)
  const userId = options.userId?.trim() || null
  const customerEmail = options.customerEmail?.trim().toLowerCase() || null

  const or: Array<{ userId: string } | { customerEmail: string }> = []
  if (userId) or.push({ userId })
  if (customerEmail) or.push({ customerEmail })

  if (orderIds.length === 0 && or.length === 0) {
    return { cancelled: 0, stockRestored: 0, reservationsCanceled: 0 }
  }

  const pending = await prisma.order.findMany({
    where:
      orderIds.length > 0
        ? { status: 'payment_pending', id: { in: orderIds } }
        : { status: 'payment_pending', OR: or },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  return cancelPendingOrdersWithStockRestoreMany(pending)
}

export async function restoreCreatedCheckoutOrders(
  orders: CancelPendingOrderInput[]
): Promise<{ cancelled: number; stockRestored: number; reservationsCanceled: number }> {
  return cancelPendingOrdersWithStockRestoreMany(orders)
}

async function cancelPendingOrdersWithStockRestoreMany(
  orders: CancelPendingOrderInput[]
): Promise<{ cancelled: number; stockRestored: number; reservationsCanceled: number }> {
  let cancelled = 0
  let stockRestored = 0
  let reservationsCanceled = 0

  for (const order of orders) {
    try {
      const result = await cancelPendingOrderWithStockRestore(order)
      if (result.cancelled) cancelled += 1
      stockRestored += result.stockRestored
      reservationsCanceled += result.reservationsCanceled
    } catch (err) {
      logger.warn(
        { orderId: order.id, err: err instanceof Error ? err.message : String(err) },
        'pending checkout hold restore failed for order'
      )
    }
  }

  return { cancelled, stockRestored, reservationsCanceled }
}

export async function cleanupStuckPayments(options?: {
  olderThanMs?: number
  limit?: number
}): Promise<{ cancelled: number; stockRestored: number; reservationsCanceled: number }> {
  if (!isDbConfigured()) {
    return { cancelled: 0, stockRestored: 0, reservationsCanceled: 0 }
  }

  const olderThanMs = options?.olderThanMs ?? DEFAULT_STUCK_AFTER_MS
  const limit = options?.limit ?? 100
  const cutoff = new Date(Date.now() - olderThanMs)

  const stuck = await prisma.order.findMany({
    where: {
      status: 'payment_pending',
      createdAt: { lt: cutoff },
    },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  return cancelPendingOrdersWithStockRestoreMany(stuck)
}
