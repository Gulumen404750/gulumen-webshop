/**
 * PointEvent outbox: megbízható, késleltetett hűségpont / loyalty feldolgozás.
 */

import type { Prisma } from '@prisma/client'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { incrementQualifyingOrder, qualifiesForLoyalty } from '@/lib/loyalty'
import { setOrderCountedForLoyalty, getOrderById } from '@/lib/orders'
import { logger } from '@/lib/logger'

export type PointEventType = 'loyalty_increment' | 'loyalty_decrement'

export async function enqueuePointEvent(
  type: PointEventType,
  payload: Prisma.InputJsonValue
): Promise<string | null> {
  if (!isDbConfigured()) return null
  const row = await prisma.pointEvent.create({
    data: {
      type,
      payload,
      status: 'pending',
    },
  })
  return row.id
}

async function processOneEvent(event: {
  id: string
  type: string
  payload: unknown
}): Promise<void> {
  const payload = (event.payload ?? {}) as {
    orderId?: string
    email?: string
    amountPaid?: number
    currency?: string
  }

  if (event.type === 'loyalty_increment') {
    const orderId = payload.orderId
    const email = payload.email
    if (!orderId || !email) throw new Error('loyalty_increment missing orderId/email')

    const order = await getOrderById(orderId)
    if (!order) throw new Error(`Order not found: ${orderId}`)
    if (order.countedForLoyalty) return

    const amount = payload.amountPaid ?? order.amountPaid ?? order.totalHuf
    const currency = payload.currency ?? order.currencyPaid ?? order.currency
    if (!qualifiesForLoyalty(amount, currency)) {
      await setOrderCountedForLoyalty(orderId, true)
      return
    }

    incrementQualifyingOrder(email)
    await setOrderCountedForLoyalty(orderId, true)
    return
  }

  throw new Error(`Unknown PointEvent type: ${event.type}`)
}

/** Feldolgozza a pending PointEvent sorokat. Visszaadja a processed/failed számokat. */
export async function processPendingPointEvents(limit = 50): Promise<{
  processed: number
  failed: number
}> {
  if (!isDbConfigured()) return { processed: 0, failed: 0 }

  const events = await prisma.pointEvent.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let processed = 0
  let failed = 0

  for (const event of events) {
    try {
      await processOneEvent(event)
      await prisma.pointEvent.update({
        where: { id: event.id },
        data: {
          status: 'processed',
          processedAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      })
      processed += 1
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : String(err)
      logger.warn({ eventId: event.id, err: message }, 'PointEvent processing failed')
      await prisma.pointEvent.update({
        where: { id: event.id },
        data: {
          status: event.attempts + 1 >= 5 ? 'failed' : 'pending',
          attempts: { increment: 1 },
          error: message.slice(0, 500),
        },
      })
    }
  }

  return { processed, failed }
}
