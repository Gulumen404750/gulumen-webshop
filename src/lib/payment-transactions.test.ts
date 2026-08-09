import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => {
  const rows = new Map<
    string,
    {
      id: string
      orderId: string
      provider: string
      mode: string
      status: string
      amount: number
      currency: string
      providerRef: string | null
      createdAt: Date
    }
  >()

  return {
    rows,
    prisma: {
      paymentTransaction: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: data.id as string,
            orderId: data.orderId as string,
            provider: data.provider as string,
            mode: data.mode as string,
            status: data.status as string,
            amount: data.amount as number,
            currency: data.currency as string,
            providerRef: (data.providerRef as string | null | undefined) ?? null,
            createdAt: new Date('2026-08-09T12:00:00.000Z'),
          }
          rows.set(row.id, row)
          return { ...row }
        }),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          const row = rows.get(where.id)
          return row ? { ...row } : null
        }),
        findMany: vi.fn(async ({ where }: { where: { orderId: string } }) => {
          return Array.from(rows.values())
            .filter((r) => r.orderId === where.orderId)
            .map((r) => ({ ...r }))
        }),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string }
            data: { status?: string; providerRef?: string }
          }) => {
            const row = rows.get(where.id)
            if (!row) throw new Error('not found')
            if (data.status !== undefined) row.status = data.status
            if (data.providerRef !== undefined) row.providerRef = data.providerRef
            return { ...row }
          }
        ),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: {
              id: string
              status?: string | { not: string } | { notIn: string[] }
            }
            data: { status: string; providerRef?: string }
          }) => {
            const row = rows.get(where.id)
            if (!row) return { count: 0 }

            const statusFilter = where.status
            if (typeof statusFilter === 'string') {
              if (row.status !== statusFilter) return { count: 0 }
            } else if (statusFilter && 'not' in statusFilter) {
              if (row.status === statusFilter.not) return { count: 0 }
            } else if (statusFilter && 'notIn' in statusFilter) {
              if (statusFilter.notIn.includes(row.status)) return { count: 0 }
            }

            row.status = data.status
            if (data.providerRef !== undefined) row.providerRef = data.providerRef
            return { count: 1 }
          }
        ),
      },
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

import {
  claimPaymentTransactionStatus,
  createPaymentTransaction,
  getPaymentTransactionById,
} from './payment-transactions'
import { isDbConfigured } from '@/lib/prisma'

describe('payment-transactions (Prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.reset()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('creates a pending transaction in DB', async () => {
    const tx = await createPaymentTransaction({
      orderId: 'ord_1',
      provider: 'stripe',
      mode: 'capture',
      amount: 5000,
      currency: 'huf',
      status: 'pending',
    })
    expect(tx.status).toBe('pending')
    expect(tx.orderId).toBe('ord_1')
    expect(mockPrisma.prisma.paymentTransaction.create).toHaveBeenCalled()
  })

  it('atomically claims succeeded only once (idempotent webhook)', async () => {
    const created = await createPaymentTransaction({
      orderId: 'ord_2',
      provider: 'stripe',
      mode: 'capture',
      amount: 1000,
      currency: 'huf',
      status: 'pending',
    })

    const first = await claimPaymentTransactionStatus(created.id, 'succeeded', 'pi_abc')
    expect(first.claimed).toBe(true)
    expect(first.tx?.status).toBe('succeeded')
    expect(first.tx?.providerRef).toBe('pi_abc')

    const second = await claimPaymentTransactionStatus(created.id, 'succeeded', 'pi_abc')
    expect(second.claimed).toBe(false)
    expect(second.alreadyInStatus).toBe(true)

    const stored = await getPaymentTransactionById(created.id)
    expect(stored?.status).toBe('succeeded')
  })

  it('does not overwrite succeeded with failed/cancelled', async () => {
    const created = await createPaymentTransaction({
      orderId: 'ord_3',
      provider: 'stripe',
      mode: 'capture',
      amount: 1000,
      currency: 'huf',
      status: 'pending',
    })
    await claimPaymentTransactionStatus(created.id, 'succeeded', 'pi_x')

    const failClaim = await claimPaymentTransactionStatus(created.id, 'failed')
    expect(failClaim.claimed).toBe(false)
    expect(failClaim.tx?.status).toBe('succeeded')
  })
})
