import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdminPermission = vi.fn()
const isDbConfigured = vi.fn()
const updateMany = vi.fn()
const logAdminAction = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    order: {
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

describe('POST /api/admin/orders/print', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminPermission.mockResolvedValue({
      ok: true,
      actor: { id: 'admin', username: 'admin', role: 'owner', bootstrap: true },
    })
    isDbConfigured.mockReturnValue(true)
    updateMany.mockResolvedValue({ count: 2 })
    logAdminAction.mockResolvedValue(undefined)
  })

  it('marks selected orders as printed', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      new Request('http://localhost/api/admin/orders/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['ord-1', 'ord-2', 'ord-1'] }),
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.ids).toEqual(['ord-1', 'ord-2'])
    expect(data.newlyPrinted).toBe(2)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ord-1', 'ord-2'] }, printedAt: null },
        data: expect.objectContaining({ printedAt: expect.any(Date) }),
      })
    )
  })

  it('rejects empty ids', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      new Request('http://localhost/api/admin/orders/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [] }),
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 when not admin', async () => {
    requireAdminPermission.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    })
    const { POST } = await import('./route')
    const res = await POST(
      new Request('http://localhost/api/admin/orders/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['ord-1'] }),
      })
    )
    expect(res.status).toBe(401)
  })
})
