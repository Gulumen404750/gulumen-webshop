import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const requireAdminPermission = vi.fn()
const isDbConfigured = vi.fn()
const listAdminOperators = vi.fn()
const createAdminOperator = vi.fn()
const logAdminAction = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
}))

vi.mock('@/lib/admin-operators', () => ({
  listAdminOperators: () => listAdminOperators(),
  createAdminOperator: (...args: unknown[]) => createAdminOperator(...args),
  updateAdminOperator: vi.fn(),
  deleteAdminOperator: vi.fn(),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

const ownerActor = { id: 'op1', username: 'anna', role: 'owner' as const }

describe('GET/POST /api/admin/staff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfigured.mockReturnValue(true)
    requireAdminPermission.mockResolvedValue({ ok: true, actor: ownerActor })
    listAdminOperators.mockResolvedValue([])
    logAdminAction.mockResolvedValue(undefined)
  })

  it('lists operators for owner', async () => {
    listAdminOperators.mockResolvedValue([
      { id: 'op1', username: 'anna', role: 'owner', active: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ])
    const { GET } = await import('@/app/api/admin/staff/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.operators[0].username).toBe('anna')
  })

  it('forbids support from staff:write', async () => {
    requireAdminPermission.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const { GET } = await import('@/app/api/admin/staff/route')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('creates an operator', async () => {
    createAdminOperator.mockResolvedValue({ id: 'op2', username: 'bela', role: 'support' })
    const { POST } = await import('@/app/api/admin/staff/route')
    const res = await POST(
      new Request('http://localhost/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bela', password: 'longenough1', role: 'support' }),
      })
    )
    expect(res.status).toBe(200)
    expect(createAdminOperator).toHaveBeenCalled()
  })
})
