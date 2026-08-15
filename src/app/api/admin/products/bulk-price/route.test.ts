import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdminPermission = vi.fn()
const isOwnerActor = vi.fn()
const isDbConfigured = vi.fn()
const findMany = vi.fn()
const transaction = vi.fn()
const update = vi.fn()
const logAdminAction = vi.fn()
const alertAdminAnomalySafe = vi.fn()
const createBulkPriceApproval = vi.fn()
const needsBulkMutationApproval = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
  isOwnerActor: (...args: unknown[]) => isOwnerActor(...args),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    product: {
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/admin-anomaly-alert', () => ({
  alertAdminAnomalySafe: (...args: unknown[]) => alertAdminAnomalySafe(...args),
}))

vi.mock('@/lib/admin-approval', () => ({
  createBulkPriceApproval: (...args: unknown[]) => createBulkPriceApproval(...args),
  needsBulkMutationApproval: (...args: unknown[]) => needsBulkMutationApproval(...args),
  BULK_DELETE_APPROVAL_THRESHOLD: 10,
}))

describe('PATCH /api/admin/products/bulk-price', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminPermission.mockResolvedValue({
      ok: true,
      actor: { id: 'admin', username: 'admin', role: 'owner', bootstrap: true },
    })
    isOwnerActor.mockReturnValue(true)
    isDbConfigured.mockReturnValue(true)
    needsBulkMutationApproval.mockReturnValue(false)
    logAdminAction.mockResolvedValue(undefined)
    alertAdminAnomalySafe.mockResolvedValue(undefined)
    update.mockResolvedValue({})
    transaction.mockResolvedValue([])
    findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        id: `p${i}`,
        priceHuf: 10000,
        priceEur: 25,
      }))
    )
  })

  it('alerts after updating many product prices (owner bypass)', async () => {
    const { PATCH } = await import('@/app/api/admin/products/bulk-price/route')
    const res = await PATCH(
      new Request('http://localhost/api/admin/products/bulk-price', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from({ length: 12 }, (_, i) => `p${i}`),
          mode: 'percent',
          percentChange: -20,
        }),
      })
    )
    expect(res.status).toBe(200)
    expect(alertAdminAnomalySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'bulk_price',
        count: 12,
        details: expect.objectContaining({ mode: 'percent', percentChange: -20 }),
      })
    )
  })

  it('returns PENDING_APPROVAL for non-owner above threshold', async () => {
    requireAdminPermission.mockResolvedValue({
      ok: true,
      actor: { id: 'c1', username: 'bela', role: 'catalog' },
    })
    isOwnerActor.mockReturnValue(false)
    needsBulkMutationApproval.mockReturnValue(true)
    createBulkPriceApproval.mockResolvedValue({
      id: 'ap1',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      secondsRemaining: 300,
    })

    const { PATCH } = await import('@/app/api/admin/products/bulk-price/route')
    const res = await PATCH(
      new Request('http://localhost/api/admin/products/bulk-price', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from({ length: 11 }, (_, i) => `p${i}`),
          mode: 'fixed',
          priceHuf: 5000,
        }),
      })
    )
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.status).toBe('PENDING_APPROVAL')
    expect(createBulkPriceApproval).toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })
})
