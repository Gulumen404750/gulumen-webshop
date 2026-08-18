import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRestore = vi.hoisted(() => vi.fn(async () => undefined))
const mockCancelReservations = vi.hoisted(() => vi.fn(async () => undefined))

const mockPrisma = vi.hoisted(() => {
  const tx = {
    order: {
      updateMany: vi.fn(),
    },
  }
  const findMany = vi.fn()

  return {
    prisma: {
      order: {
        findMany,
        updateMany: tx.order.updateMany,
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
    tx,
    reset() {
      tx.order.updateMany.mockReset()
      findMany.mockReset()
      mockRestore.mockClear()
      mockCancelReservations.mockClear()
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma.prisma,
  isDbConfigured: vi.fn(() => true),
}))

vi.mock('@/lib/inventory', () => ({
  restoreStockAtomic: mockRestore,
}))

vi.mock('@/lib/reservations', () => ({
  markReservationsCanceledByOrderId: mockCancelReservations,
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import {
  cancelPendingOrderWithStockRestore,
  cleanupStuckPayments,
  releasePendingCheckoutHolds,
  restoreCreatedCheckoutOrders,
} from './stuck-payments'
import { isDbConfigured } from '@/lib/prisma'

describe('cancelPendingOrderWithStockRestore (webhook stock restore)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reset()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('CAS-cancels payment_pending and restores in_stock qty', async () => {
    mockPrisma.tx.order.updateMany.mockResolvedValue({ count: 1 })

    const result = await cancelPendingOrderWithStockRestore({
      id: 'ord_1',
      orderType: 'in_stock',
      items: [
        { productId: 'p1', qty: 2, fulfillmentType: 'stock' },
        { productId: 'p2', qty: 1, fulfillmentType: 'stock' },
        { productId: 'p3', qty: 5, fulfillmentType: 'procurement' },
      ],
    })

    expect(mockPrisma.tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'ord_1', status: 'payment_pending' },
      data: { status: 'cancelled' },
    })
    expect(mockRestore).toHaveBeenCalledWith(
      [
        { productId: 'p1', qty: 2 },
        { productId: 'p2', qty: 1 },
      ],
      mockPrisma.tx
    )
    expect(mockCancelReservations).not.toHaveBeenCalled()
    expect(result).toEqual({
      cancelled: true,
      stockRestored: 3,
      reservationsCanceled: 0,
    })
  })

  it('is a no-op when order is no longer payment_pending (idempotent webhook)', async () => {
    mockPrisma.tx.order.updateMany.mockResolvedValue({ count: 0 })

    const result = await cancelPendingOrderWithStockRestore({
      id: 'ord_paid',
      orderType: 'in_stock',
      items: [{ productId: 'p1', qty: 1, fulfillmentType: 'stock' }],
    })

    expect(mockRestore).not.toHaveBeenCalled()
    expect(result).toEqual({
      cancelled: false,
      stockRestored: 0,
      reservationsCanceled: 0,
    })
  })

  it('cancels sourcing reservations without stock restore', async () => {
    mockPrisma.tx.order.updateMany.mockResolvedValue({ count: 1 })

    const result = await cancelPendingOrderWithStockRestore({
      id: 'ord_src',
      orderType: 'sourcing',
      items: [{ productId: 'deal-1', qty: 1, fulfillmentType: 'procurement' }],
    })

    expect(mockRestore).not.toHaveBeenCalled()
    expect(mockCancelReservations).toHaveBeenCalledWith('ord_src')
    expect(result).toEqual({
      cancelled: true,
      stockRestored: 0,
      reservationsCanceled: 1,
    })
  })

  it('returns zeros when DATABASE_URL is not configured', async () => {
    vi.mocked(isDbConfigured).mockReturnValue(false)

    const result = await cancelPendingOrderWithStockRestore({
      id: 'ord_x',
      orderType: 'in_stock',
      items: [{ productId: 'p1', qty: 1, fulfillmentType: 'stock' }],
    })

    expect(mockPrisma.prisma.$transaction).not.toHaveBeenCalled()
    expect(result).toEqual({
      cancelled: false,
      stockRestored: 0,
      reservationsCanceled: 0,
    })
  })
})

describe('cleanupStuckPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reset()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('aggregates stock restore across stuck pending orders', async () => {
    mockPrisma.prisma.order.findMany.mockResolvedValue([
      {
        id: 'stuck-1',
        orderType: 'in_stock',
        items: [{ productId: 'a', qty: 2, fulfillmentType: 'stock' }],
      },
      {
        id: 'stuck-2',
        orderType: 'in_stock',
        items: [{ productId: 'b', qty: 1, fulfillmentType: 'stock' }],
      },
    ])
    mockPrisma.tx.order.updateMany.mockResolvedValue({ count: 1 })

    const result = await cleanupStuckPayments({ olderThanMs: 1, limit: 10 })

    expect(result.cancelled).toBe(2)
    expect(result.stockRestored).toBe(3)
    expect(mockRestore).toHaveBeenCalledTimes(2)
  })
})

describe('releasePendingCheckoutHolds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reset()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('cancels the buyer payment_pending orders by userId or email and restores stock', async () => {
    mockPrisma.prisma.order.findMany.mockResolvedValue([
      {
        id: 'hold-1',
        orderType: 'in_stock',
        items: [{ productId: 'sku-a', qty: 1, fulfillmentType: 'stock' }],
      },
    ])
    mockPrisma.tx.order.updateMany.mockResolvedValue({ count: 1 })

    const result = await releasePendingCheckoutHolds({
      userId: 'user_1',
      customerEmail: 'Buyer@Gulumen.com',
    })

    expect(mockPrisma.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'payment_pending',
          OR: [{ userId: 'user_1' }, { customerEmail: 'buyer@gulumen.com' }],
        },
      })
    )
    expect(result).toEqual({
      cancelled: 1,
      stockRestored: 1,
      reservationsCanceled: 0,
    })
  })

  it('restores specific created checkout order ids after Stripe session failure', async () => {
    mockPrisma.prisma.order.findMany.mockResolvedValue([
      {
        id: 'ord_new',
        orderType: 'in_stock',
        items: [{ productId: 'sku-a', qty: 2, fulfillmentType: 'stock' }],
      },
    ])
    mockPrisma.tx.order.updateMany.mockResolvedValue({ count: 1 })

    const result = await releasePendingCheckoutHolds({
      orderIds: ['ord_new'],
      userId: 'user_1',
    })

    expect(mockPrisma.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'payment_pending', id: { in: ['ord_new'] } },
      })
    )
    expect(result.cancelled).toBe(1)
    expect(result.stockRestored).toBe(2)
  })

  it('is a no-op without user, email or order ids', async () => {
    const result = await releasePendingCheckoutHolds({})
    expect(mockPrisma.prisma.order.findMany).not.toHaveBeenCalled()
    expect(result).toEqual({ cancelled: 0, stockRestored: 0, reservationsCanceled: 0 })
  })
})

describe('restoreCreatedCheckoutOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reset()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('CAS-cancels the just-created pending orders without a second findMany', async () => {
    mockPrisma.tx.order.updateMany.mockResolvedValue({ count: 1 })

    const result = await restoreCreatedCheckoutOrders([
      {
        id: 'ord_1',
        orderType: 'in_stock',
        items: [{ productId: 'p1', qty: 1, fulfillmentType: 'stock' }],
      },
      {
        id: 'ord_2',
        orderType: 'sourcing',
        items: [{ productId: 'deal-1', qty: 1, fulfillmentType: 'procurement' }],
      },
    ])

    expect(mockPrisma.prisma.order.findMany).not.toHaveBeenCalled()
    expect(mockRestore).toHaveBeenCalledTimes(1)
    expect(mockCancelReservations).toHaveBeenCalledWith('ord_2')
    expect(result).toEqual({
      cancelled: 2,
      stockRestored: 1,
      reservationsCanceled: 1,
    })
  })
})
