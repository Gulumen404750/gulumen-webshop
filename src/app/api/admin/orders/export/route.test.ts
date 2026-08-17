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
    findMany.mockResolvedValue([
      {
        id: 'ord_1787000691252abc',
        createdAt: new Date('2026-08-17T21:04:51.000Z'),
        customerName: 'Deak Daniel',
        customerEmail: 'lauti404750@gmail.com',
        status: 'paid',
        orderType: 'in_stock',
        items: [
          {
            name: 'Rózsaszín kuka',
            sku: 'GUL-0000001454',
            qty: 1,
            priceHuf: 4500,
            fulfillmentType: 'stock',
            parameters: { colorName: 'Rózsaszín', materialName: 'PLA' },
          },
          {
            name: 'Lámpa',
            sku: 'GUL-0000001455',
            qty: 2,
            priceHuf: 8500,
            fulfillmentType: 'stock',
            parameters: { colorName: 'Fehér', materialName: 'PETG' },
          },
        ],
      },
    ])
  })

  it('exports a line-item CSV and evaluates the anomaly threshold without blocking', async () => {
    const { GET } = await import('@/app/api/admin/orders/export/route')
    const res = await GET(
      new Request('http://localhost/api/admin/orders/export?format=csv')
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-type')).toContain('charset=utf-8')
    expect(alertAdminAnomalySafe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'csv_export', count: 2 })
    )
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const csv = new TextDecoder('utf-8').decode(bytes.slice(3))
    expect(csv).toContain('Rendelés ID;Dátum és Idő;Vevő Neve;Vevő Email;Státusz;')
    expect(csv).toContain('GUL-0000001454')
    expect(csv).toContain('GUL-0000001455')
    expect(csv).toContain('PLA')
    expect(csv).toContain('Fizetve')
    expect(csv).toContain('Deak Daniel')
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
