import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const requireAdminPermission = vi.fn()
const isDbConfigured = vi.fn()
const findMany = vi.fn()
const logAdminAction = vi.fn()
const alertAdminAnomalySafe = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    order: { findMany: (...args: unknown[]) => findMany(...args) },
  },
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/admin-anomaly-alert', () => ({
  alertAdminAnomalySafe: (...args: unknown[]) => alertAdminAnomalySafe(...args),
}))

describe('GET /api/admin/orders/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminPermission.mockResolvedValue({
      ok: true,
      actor: { id: 'admin', username: 'admin', role: 'owner', bootstrap: true },
    })
    isDbConfigured.mockReturnValue(true)
    logAdminAction.mockResolvedValue(undefined)
    alertAdminAnomalySafe.mockResolvedValue(undefined)
    findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `o${i}`,
        createdAt: new Date('2026-08-14T00:00:00Z'),
        customerEmail: `u${i}@example.com`,
        status: 'paid',
        totalHuf: 1000,
        orderType: 'in_stock',
      }))
    )
  })

  it('exports CSV and evaluates the anomaly threshold without blocking', async () => {
    const { GET } = await import('@/app/api/admin/orders/export/route')
    const res = await GET(
      new Request('http://localhost/api/admin/orders/export?format=csv')
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(alertAdminAnomalySafe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'csv_export', count: 3 })
    )
  })

  it('does not export when unauthorized', async () => {
    requireAdminPermission.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const { GET } = await import('@/app/api/admin/orders/export/route')
    const res = await GET(
      new Request('http://localhost/api/admin/orders/export?format=csv')
    )
    expect(res.status).toBe(401)
    expect(alertAdminAnomalySafe).not.toHaveBeenCalled()
  })
})
