/**
 * Sourcing slot atomi foglalás (maxOrders race condition védelem).
 * ProductReservation: RESERVED (15 min) → PAID (webhook) vagy EXPIRED.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'

const RESERVED_EXPIRY_MINUTES = 15
const ACTIVE_STATUSES = ['RESERVED', 'PAID'] as const

export class SoldOutError extends Error {
  constructor(public productId: string) {
    super('Sold out')
    this.name = 'SoldOutError'
  }
}

/** Aktív slotok száma termékre: PAID vagy RESERVED (expiresAt > now). */
function countActiveReservations(productId: string, now: Date): Promise<number> {
  return prisma.productReservation.count({
    where: {
      productId,
      status: { in: [...ACTIVE_STATUSES] },
      OR: [
        { status: 'PAID' },
        { status: 'RESERVED', expiresAt: { gt: now } },
      ],
    },
  })
}

/**
 * Egy tranzakcióban foglal N slotot egy termékre. Ha count + N > maxOrders → SoldOutError.
 * Visszaadja az új reservation id-kat.
 */
async function reserveSlotsForProduct(
  productId: string,
  qty: number,
  maxOrders: number,
  now: Date,
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<string[]> {
  const ids: string[] = []
  const expiry = new Date(now.getTime() + RESERVED_EXPIRY_MINUTES * 60 * 1000)
  for (let i = 0; i < qty; i++) {
    const currentCount = await tx.productReservation.count({
      where: {
        productId,
        status: { in: [...ACTIVE_STATUSES] },
        OR: [
          { status: 'PAID' },
          { status: 'RESERVED', expiresAt: { gt: now } },
        ],
      },
    })
    if (currentCount >= maxOrders) {
      throw new SoldOutError(productId)
    }
    const r = await tx.productReservation.create({
      data: {
        productId,
        status: 'RESERVED',
        expiresAt: expiry,
      },
    })
    ids.push(r.id)
  }
  return ids
}

export type SourcingSlotItem = { productId: string; qty: number }

/**
 * Atomosan foglal slotokat minden sourcing tételre. Ha bármelyik termékre nincs elég hely → SoldOutError.
 * Csak DB konfigurált esetén hívandó. Visszaadja az összes létrehozott reservation id-t (sorrend: termékek, majd qty).
 */
export async function reserveSourcingSlots(
  items: SourcingSlotItem[],
  getMaxOrders: (productId: string) => number
): Promise<string[]> {
  if (!isDbConfigured()) return []
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const allIds: string[] = []
    for (const { productId, qty } of items) {
      if (qty < 1) continue
      const maxOrders = getMaxOrders(productId)
      const ids = await reserveSlotsForProduct(productId, qty, maxOrders, now, tx)
      allIds.push(...ids)
    }
    return allIds
  })
}

/** Foglalások összerendelése a létrehozott rendeléssel (orderId). */
export async function linkReservationsToOrder(
  reservationIds: string[],
  orderId: string
): Promise<void> {
  if (!isDbConfigured() || reservationIds.length === 0) return
  await prisma.productReservation.updateMany({
    where: { id: { in: reservationIds } },
    data: { orderId },
  })
}

/**
 * Fizetés siker: reservation státusz PAID. Idempotens (már PAID is ok).
 */
export async function markReservationsPaidByOrderId(orderId: string): Promise<void> {
  if (!isDbConfigured()) return
  await prisma.productReservation.updateMany({
    where: { orderId, status: 'RESERVED' },
    data: { status: 'PAID' },
  })
}

/**
 * Sourcing sikertelen / hold cancel: reservation CANCELED → slot felszabadul. Idempotens.
 */
export async function markReservationsCanceledByOrderId(orderId: string): Promise<void> {
  if (!isDbConfigured()) return
  await prisma.productReservation.updateMany({
    where: { orderId, status: { in: ['RESERVED', 'PAID'] } },
    data: { status: 'CANCELED' },
  })
}

/**
 * Aktív (nem lejárt) foglalások száma termékre – pl. getTimedPurchaseStatus / UI számára.
 * DB nélkül 0.
 */
export async function getActiveReservationCount(productId: string): Promise<number> {
  if (!isDbConfigured()) return 0
  const now = new Date()
  return countActiveReservations(productId, now)
}
