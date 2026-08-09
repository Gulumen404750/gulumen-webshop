import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => {
  const rows = new Map<
    string,
    {
      id: string
      status: string
      paidWebhookEventId: string | null
      stripeSessionId: string | null
      paymentIntentId: string | null
      amountPaid: number | null
      currencyPaid: string | null
      customerEmail: string | null
      refundStatus: string | null
      refundedAmount: number | null
      paidAt: Date | null
      items: []
      // unused fields for dbOrderToOrder compatibility
      orderGroupId: null
      orderType: null
      subtotalHuf: number
      discountHuf: number
      totalHuf: number
      currency: string
      createdAt: Date
      countedForLoyalty: boolean
      cancelRequestedAt: null
      userId: null
      pointsDiscountHuf: number
      pointsUsed: number
      couponId: null
      couponUsageRecorded: boolean
    }
  >()

  return {
    rows,
    prisma: {
      order: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          const row = rows.get(where.id)
          return row ? { ...row, items: [] } : null
        }),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string; status: string | { in: string[] } }
            data: Record<string, unknown>
          }) => {
            const row = rows.get(where.id)
            if (!row) return { count: 0 }
            const allowed =
              typeof where.status === 'string'
                ? [where.status]
                : where.status.in
            if (!allowed.includes(row.status)) return { count: 0 }
            Object.assign(row, data)
            return { count: 1 }
          }
        ),
      },
    },
    seed(id: string, status: string) {
      rows.set(id, {
        id,
        status,
        paidWebhookEventId: null,
        stripeSessionId: null,
        paymentIntentId: null,
        amountPaid: null,
        currencyPaid: null,
        customerEmail: null,
        refundStatus: 'none',
        refundedAmount: 0,
        paidAt: null,
        items: [],
        orderGroupId: null,
        orderType: null,
        subtotalHuf: 1000,
        discountHuf: 0,
        totalHuf: 1000,
        currency: 'huf',
        createdAt: new Date('2026-08-09T12:00:00.000Z'),
        countedForLoyalty: false,
        cancelRequestedAt: null,
        userId: null,
        pointsDiscountHuf: 0,
        pointsUsed: 0,
        couponId: null,
        couponUsageRecorded: false,
      })
    },
    reset() {
      rows.clear()
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma.prisma,
  isDbConfigured: vi.fn(() => true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { setOrderPaid } from './orders'
import { isDbConfigured } from '@/lib/prisma'

describe('setOrderPaid status-CAS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reset()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('CAS: payment_pending → paid only once', async () => {
    mockPrisma.seed('ord_1', 'payment_pending')

    const first = await setOrderPaid({
      orderId: 'ord_1',
      stripeSessionId: 'cs_1',
      paymentIntentId: 'pi_1',
      amountPaid: 1000,
      currencyPaid: 'huf',
      webhookEventId: 'evt_1',
    })
    expect(first.order?.status).toBe('paid')
    expect(first.latePayment).toBe(false)
    expect(mockPrisma.prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'ord_1',
          status: { in: expect.arrayContaining(['payment_pending']) },
        }),
        data: expect.objectContaining({ status: 'paid' }),
      })
    )

    const second = await setOrderPaid({
      orderId: 'ord_1',
      stripeSessionId: 'cs_1',
      paymentIntentId: 'pi_1',
      amountPaid: 1000,
      currencyPaid: 'huf',
      webhookEventId: 'evt_2',
    })
    expect(second.order?.status).toBe('paid')
    expect(second.latePayment).toBe(false)
    // second call short-circuits on already paid – no extra paid transition
    const paidTransitions = mockPrisma.prisma.order.updateMany.mock.calls.filter((c) => {
      const arg = c[0] as { data?: { status?: string } }
      return arg.data?.status === 'paid'
    })
    expect(paidTransitions).toHaveLength(1)
  })

  it('does not mark paid when status is already cancelled (late → needs_manual_review)', async () => {
    mockPrisma.seed('ord_late', 'cancelled')

    const result = await setOrderPaid({
      orderId: 'ord_late',
      stripeSessionId: 'cs_x',
      amountPaid: 500,
      currencyPaid: 'huf',
      webhookEventId: 'evt_late',
    })

    expect(result.latePayment).toBe(true)
    expect(result.order?.status).toBe('needs_manual_review')
    expect(mockPrisma.prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'needs_manual_review' }),
      })
    )
  })

  it('losing CAS race against another paid writer returns paid idempotently', async () => {
    mockPrisma.seed('ord_race', 'payment_pending')
    mockPrisma.prisma.order.updateMany.mockResolvedValueOnce({ count: 0 })
    // After failed claim, findUnique returns paid (other writer won)
    mockPrisma.rows.get('ord_race')!.status = 'paid'

    const result = await setOrderPaid({
      orderId: 'ord_race',
      stripeSessionId: 'cs_r',
      amountPaid: 1000,
      currencyPaid: 'huf',
      webhookEventId: 'evt_r',
    })

    expect(result.order?.status).toBe('paid')
    expect(result.latePayment).toBe(false)
  })
})
