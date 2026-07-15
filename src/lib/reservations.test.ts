import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => {
  const reservations: Array<{
    id: string
    productId: string
    status: string
    expiresAt: Date
    orderId?: string | null
  }> = []

  let idCounter = 0

  const tx = {
    productReservation: {
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const now = (where.OR as Array<{ expiresAt?: { gt: Date } }> | undefined)
          ? new Date()
          : new Date()
        return reservations.filter((r) => {
          if (r.productId !== (where.productId as string)) return false
          const statuses = where.status as { in: string[] }
          if (!statuses.in.includes(r.status)) return false
          if (r.status === 'RESERVED') {
            const orClause = where.OR as Array<{ status: string; expiresAt?: { gt: Date } }>
            const reservedClause = orClause?.find((c) => c.status === 'RESERVED')
            if (reservedClause?.expiresAt?.gt) {
              return r.expiresAt > reservedClause.expiresAt.gt
            }
          }
          return r.status === 'PAID' || r.status === 'RESERVED'
        }).length
      }),
      create: vi.fn(async ({ data }: { data: { productId: string; status: string; expiresAt: Date } }) => {
        const row = {
          id: `res-${++idCounter}`,
          productId: data.productId,
          status: data.status,
          expiresAt: data.expiresAt,
          orderId: null,
        }
        reservations.push(row)
        return row
      }),
    },
  }

  return {
    prisma: {
      productReservation: {
        count: tx.productReservation.count,
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
    tx,
    reservations,
    reset() {
      reservations.length = 0
      idCounter = 0
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma.prisma,
  isDbConfigured: vi.fn(() => true),
}))

import {
  getActiveReservationCount,
  reserveSourcingSlots,
  SoldOutError,
} from './reservations'
import { isDbConfigured } from '@/lib/prisma'

describe('reserveSourcingSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reset()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('creates RESERVED slots with 15-minute expiry', async () => {
    const before = Date.now()
    const ids = await reserveSourcingSlots(
      [{ productId: 'prod-1', qty: 2 }],
      () => 5
    )
    const after = Date.now()

    expect(ids).toHaveLength(2)
    expect(mockPrisma.reservations).toHaveLength(2)
    for (const r of mockPrisma.reservations) {
      expect(r.status).toBe('RESERVED')
      expect(r.productId).toBe('prod-1')
      const expiryMs = r.expiresAt.getTime() - before
      expect(expiryMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 50)
      expect(expiryMs).toBeLessThanOrEqual(15 * 60 * 1000 + (after - before) + 50)
    }
  })

  it('throws SoldOutError when maxOrders would be exceeded', async () => {
    mockPrisma.reservations.push(
      { id: 'r1', productId: 'prod-1', status: 'PAID', expiresAt: new Date(Date.now() + 60_000) },
      { id: 'r2', productId: 'prod-1', status: 'PAID', expiresAt: new Date(Date.now() + 60_000) },
    )

    await expect(
      reserveSourcingSlots([{ productId: 'prod-1', qty: 1 }], () => 2)
    ).rejects.toBeInstanceOf(SoldOutError)

    expect(mockPrisma.reservations).toHaveLength(2)
  })

  it('ignores expired RESERVED slots when checking capacity', async () => {
    mockPrisma.reservations.push({
      id: 'expired',
      productId: 'prod-1',
      status: 'RESERVED',
      expiresAt: new Date(Date.now() - 60_000),
    })

    const ids = await reserveSourcingSlots(
      [{ productId: 'prod-1', qty: 1 }],
      () => 1
    )

    expect(ids).toHaveLength(1)
    expect(mockPrisma.reservations).toHaveLength(2)
  })

  it('returns empty array when DB is not configured', async () => {
    vi.mocked(isDbConfigured).mockReturnValue(false)

    const ids = await reserveSourcingSlots(
      [{ productId: 'prod-1', qty: 3 }],
      () => 10
    )

    expect(ids).toEqual([])
    expect(mockPrisma.prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('getActiveReservationCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reset()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('counts PAID and non-expired RESERVED only', async () => {
    const now = Date.now()
    mockPrisma.reservations.push(
      { id: 'paid', productId: 'prod-1', status: 'PAID', expiresAt: new Date(now + 60_000) },
      { id: 'active', productId: 'prod-1', status: 'RESERVED', expiresAt: new Date(now + 60_000) },
      { id: 'expired', productId: 'prod-1', status: 'RESERVED', expiresAt: new Date(now - 60_000) },
      { id: 'canceled', productId: 'prod-1', status: 'CANCELED', expiresAt: new Date(now + 60_000) },
    )

    const count = await getActiveReservationCount('prod-1')
    expect(count).toBe(2)
  })
})
