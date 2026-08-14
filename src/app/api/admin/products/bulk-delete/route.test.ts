import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdminPermission = vi.fn()
const isDbConfigured = vi.fn()
const createBulkDeleteApproval = vi.fn()
const needsBulkDeleteApproval = vi.fn()
const executeBulkDelete = vi.fn()
const logAdminAction = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
  isOwnerActor: (actor: { role: string; bootstrap?: boolean }) =>
    actor.role === 'owner' || Boolean(actor.bootstrap),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
}))

vi.mock('@/lib/admin-approval', () => ({
  createBulkDeleteApproval: (...args: unknown[]) => createBulkDeleteApproval(...args),
  needsBulkDeleteApproval: (...args: unknown[]) => needsBulkDeleteApproval(...args),
  BULK_DELETE_APPROVAL_THRESHOLD: 10,
}))

vi.mock('@/lib/admin-bulk-delete', () => ({
  executeBulkDelete: (...args: unknown[]) => executeBulkDelete(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

describe('POST /api/admin/products/bulk-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfigured.mockReturnValue(true)
    logAdminAction.mockResolvedValue(undefined)
  })

  it('returns PENDING_APPROVAL for non-owner above threshold', async () => {
    requireAdminPermission.mockResolvedValue({
      ok: true,
      actor: { id: 'c1', username: 'bela', role: 'catalog' },
    })
    needsBulkDeleteApproval.mockReturnValue(true)
    createBulkDeleteApproval.mockResolvedValue({
      id: 'appr-1',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      secondsRemaining: 300,
    })
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`)
    const { POST } = await import('./route')
    const res = await POST(
      new Request('http://localhost/api/admin/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids }),
      })
    )
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.status).toBe('PENDING_APPROVAL')
    expect(data.approvalId).toBe('appr-1')
    expect(executeBulkDelete).not.toHaveBeenCalled()
  })

  it('deletes immediately for owner', async () => {
    requireAdminPermission.mockResolvedValue({
      ok: true,
      actor: { id: 'admin', username: 'admin', role: 'owner', bootstrap: true },
    })
    needsBulkDeleteApproval.mockReturnValue(false)
    executeBulkDelete.mockResolvedValue({ deleted: 11, missing: 0 })
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`)
    const { POST } = await import('./route')
    const res = await POST(
      new Request('http://localhost/api/admin/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids }),
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('DELETED')
    expect(executeBulkDelete).toHaveBeenCalled()
  })
})
