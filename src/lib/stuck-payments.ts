/**
 * Elakadt payment_pending rendelések takarítása:
 * - status → cancelled
 * - in_stock készlet visszaírása
 * - sourcing reservation CANCELED
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { restoreStockAtomic } from '@/lib/inventory'
import { markReservationsCanceledByOrderId } from '@/lib/reservations'
import { logger } from '@/lib/logger'

const DEFAULT_STUCK_AFTER_MS = 45 * 60 * 1000

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

  let cancelled = 0
  let stockRestored = 0
  let reservationsCanceled = 0

  for (const order of stuck) {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: 'payment_pending' },
          data: { status: 'cancelled' },
        })
        if (updated.count === 0) return

        if (order.orderType === 'in_stock' || !order.orderType) {
          const stockItems = order.items
            .filter((i) => i.fulfillmentType === 'stock')
            .map((i) => ({ productId: i.productId, qty: i.qty }))
          if (stockItems.length > 0) {
            await restoreStockAtomic(stockItems, tx)
            stockRestored += stockItems.reduce((s, i) => s + i.qty, 0)
          }
        }
      })

      if (order.orderType === 'sourcing') {
        await markReservationsCanceledByOrderId(order.id)
        reservationsCanceled += 1
      }

      cancelled += 1
    } catch (err) {
      logger.warn(
        { orderId: order.id, err: err instanceof Error ? err.message : String(err) },
        'cleanupStuckPayments failed for order'
      )
    }
  }

  return { cancelled, stockRestored, reservationsCanceled }
}
