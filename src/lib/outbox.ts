/**
 * Outbox worker: lejárt reservationök + pending PointEvent-ek.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { processPendingPointEvents } from '@/lib/point-events'

/** Lejárt RESERVED foglalások → EXPIRED. */
export async function expireReservations(): Promise<number> {
  if (!isDbConfigured()) return 0
  const now = new Date()
  const result = await prisma.productReservation.updateMany({
    where: {
      status: 'RESERVED',
      expiresAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  })
  return result.count
}

/**
 * Paid rendelések loyalty recovery: ha countedForLoyalty=false és van email,
 * PointEvent enqueue (ha még nincs pending ugyanarra).
 */
export async function enqueueMissingLoyaltyEvents(limit = 50): Promise<number> {
  if (!isDbConfigured()) return 0

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['paid', 'fulfilled'] },
      countedForLoyalty: false,
      customerEmail: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      customerEmail: true,
      amountPaid: true,
      totalHuf: true,
      currencyPaid: true,
      currency: true,
    },
  })

  const recentEvents = await prisma.pointEvent.findMany({
    where: {
      type: 'loyalty_increment',
      status: { in: ['pending', 'processed'] },
    },
    select: { payload: true },
    take: 500,
    orderBy: { createdAt: 'desc' },
  })
  const existingOrderIds = new Set(
    recentEvents
      .map((e) => {
        const p = e.payload as { orderId?: string } | null
        return p?.orderId
      })
      .filter((id): id is string => Boolean(id))
  )

  let enqueued = 0
  for (const order of orders) {
    if (!order.customerEmail) continue
    if (existingOrderIds.has(order.id)) continue

    await prisma.pointEvent.create({
      data: {
        type: 'loyalty_increment',
        status: 'pending',
        payload: {
          orderId: order.id,
          email: order.customerEmail,
          amountPaid: order.amountPaid ?? order.totalHuf,
          currency: order.currencyPaid ?? order.currency,
        },
      },
    })
    existingOrderIds.add(order.id)
    enqueued += 1
  }
  return enqueued
}

export async function processOutbox(): Promise<{
  expiredReservations: number
  loyaltyEnqueued: number
  pointEventsProcessed: number
  pointEventsFailed: number
}> {
  const expiredReservations = await expireReservations()
  const loyaltyEnqueued = await enqueueMissingLoyaltyEvents()
  const { processed, failed } = await processPendingPointEvents()
  return {
    expiredReservations,
    loyaltyEnqueued,
    pointEventsProcessed: processed,
    pointEventsFailed: failed,
  }
}
