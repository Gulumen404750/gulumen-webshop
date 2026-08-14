import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const isDbConfigured = vi.fn()
const findMany = vi.fn()
const transaction = vi.fn()
const update = vi.fn()
const logAdminAction = vi.fn()
const alertAdminAnomalySafe = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => requireAdmin(),
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

describe('PATCH /api/admin/products/bulk-price', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue(true)
    isDbConfigured.mockReturnValue(true)
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

  it('alerts after updating many product prices', async () => {
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
})
