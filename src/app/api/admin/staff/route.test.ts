import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const requireAdminPermission = vi.fn()
const isDbConfigured = vi.fn()
const listAdminOperators = vi.fn()
const createAdminOperator = vi.fn()
const deleteAdminOperator = vi.fn()
const updateAdminOperator = vi.fn()
const logAdminAction = vi.fn()

vi.mock('@/lib/admin-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin-auth')>('@/lib/admin-auth')
  return {
    ...actual,
    requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
  }
})

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
}))

vi.mock('@/lib/admin-operators', () => ({
  listAdminOperators: () => listAdminOperators(),
  createAdminOperator: (...args: unknown[]) => createAdminOperator(...args),
  updateAdminOperator: (...args: unknown[]) => updateAdminOperator(...args),
  deleteAdminOperator: (...args: unknown[]) => deleteAdminOperator(...args),
  countActiveOwners: () => Promise.resolve(1),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

const ownerActor = { id: 'op1', username: 'anna', role: 'owner' as const }
const masterActor = {
  id: 'admin',
  username: 'admin',
  role: 'owner' as const,
  bootstrap: true,
}

describe('GET/POST /api/admin/staff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfigured.mockReturnValue(true)
    requireAdminPermission.mockResolvedValue({ ok: true, actor: ownerActor })
    listAdminOperators.mockResolvedValue([])
    logAdminAction.mockResolvedValue(undefined)
  })

  it('lists operators for owner and reports masterSession=false for DB owner', async () => {
    listAdminOperators.mockResolvedValue([
      { id: 'op1', username: 'anna', role: 'owner', active: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ])
    const { GET } = await import('@/app/api/admin/staff/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.operators[0].username).toBe('anna')
    expect(data.masterSession).toBe(false)
    expect(data.roleAccess.catalog.permissions.length).toBeGreaterThan(0)
    expect(
      data.roleAccess.catalog.permissions.find(
        (p: { permission: string }) => p.permission === 'customers:pii'
      )?.granted
    ).toBe(false)
  })

  it('reports masterSession=true for ADMIN_API_KEY bootstrap', async () => {
    requireAdminPermission.mockResolvedValue({ ok: true, actor: masterActor })
    const { GET } = await import('@/app/api/admin/staff/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.masterSession).toBe(true)
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

  it('creates an operator without rewriting master session', async () => {
    requireAdminPermission.mockResolvedValue({ ok: true, actor: masterActor })
    createAdminOperator.mockResolvedValue({ id: 'op2', username: 'bela', role: 'owner' })
    const { POST } = await import('@/app/api/admin/staff/route')
    const res = await POST(
      new Request('http://localhost/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bela', password: 'longenough1', role: 'owner' }),
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sessionUpgraded).toBe(false)
    expect(data.masterSessionPreserved).toBe(true)
    expect(createAdminOperator).toHaveBeenCalled()
  })

  it('deletes an operator via POST action=delete', async () => {
    deleteAdminOperator.mockResolvedValue('ok')
    const { POST } = await import('@/app/api/admin/staff/route')
    const res = await POST(
      new Request('http://localhost/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: 'op2' }),
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.deletedId).toBe('op2')
    expect(deleteAdminOperator).toHaveBeenCalledWith('op2', { allowLastOwnerOverride: false })
  })

  it('rejects deleting the last owner for DB owner session', async () => {
    deleteAdminOperator.mockResolvedValue('last_owner')
    const { POST } = await import('@/app/api/admin/staff/route')
    const res = await POST(
      new Request('http://localhost/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: 'op1' }),
      })
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.code).toBe('last_owner')
  })

  it('master session deletes last owner with override', async () => {
    requireAdminPermission.mockResolvedValue({ ok: true, actor: masterActor })
    deleteAdminOperator.mockResolvedValue('ok')
    const { POST } = await import('@/app/api/admin/staff/route')
    const res = await POST(
      new Request('http://localhost/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: 'op1' }),
      })
    )
    expect(res.status).toBe(200)
    expect(deleteAdminOperator).toHaveBeenCalledWith('op1', { allowLastOwnerOverride: true })
  })

  it('master session can demote or disable the last owner', async () => {
    requireAdminPermission.mockResolvedValue({ ok: true, actor: masterActor })
    updateAdminOperator.mockResolvedValue({ id: 'op1', username: 'anna', role: 'support' })
    const { PATCH } = await import('@/app/api/admin/staff/route')
    const res = await PATCH(
      new Request('http://localhost/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'op1', role: 'support' }),
      })
    )
    expect(res.status).toBe(200)
    expect(updateAdminOperator).toHaveBeenCalledWith(
      'op1',
      { role: 'support' },
      { allowLastOwnerOverride: true }
    )
  })
})
