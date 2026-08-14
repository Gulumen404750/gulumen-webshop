import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const isDbConfigured = vi.fn()
const getAdminKeyPolicyStatus = vi.fn()
const setAdminMustChangeKey = vi.fn()
const logAdminAction = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => requireAdmin(),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
}))

vi.mock('@/lib/admin-key-policy', () => ({
  getAdminKeyPolicyStatus: () => getAdminKeyPolicyStatus(),
  setAdminMustChangeKey: (...args: unknown[]) => setAdminMustChangeKey(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

describe('/api/admin/key-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue(true)
    isDbConfigured.mockReturnValue(true)
    logAdminAction.mockResolvedValue(undefined)
    setAdminMustChangeKey.mockResolvedValue(undefined)
    getAdminKeyPolicyStatus.mockResolvedValue({
      mustChangeKey: false,
      keyConfirmedAt: null,
      maxAgeDays: 90,
      daysOld: null,
      fingerprintPrefix: null,
    })
  })

  it('returns policy status for an admin session', async () => {
    const { GET } = await import('@/app/api/admin/key-policy/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.maxAgeDays).toBe(90)
    expect(data.mustChangeKey).toBe(false)
    expect(data).not.toHaveProperty('apiKeyFingerprint')
  })

  it('sets mustChangeKey', async () => {
    const { POST } = await import('@/app/api/admin/key-policy/route')
    const res = await POST(
      new Request('http://localhost/api/admin/key-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mustChangeKey: true }),
      })
    )
    expect(res.status).toBe(200)
    expect(setAdminMustChangeKey).toHaveBeenCalledWith(true)
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'must_change_key', success: true })
    )
  })

  it('returns 401 when not admin', async () => {
    requireAdmin.mockResolvedValue(false)
    const { GET } = await import('@/app/api/admin/key-policy/route')
    expect((await GET()).status).toBe(401)
  })
})
