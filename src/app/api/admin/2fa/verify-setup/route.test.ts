import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const isDbConfigured = vi.fn()
const getAdminTwoFactorState = vi.fn()
const confirmAdminTotpSetup = vi.fn()
const verifyTotpCode = vi.fn()
const rateLimit = vi.fn()
const logAdminAction = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => requireAdmin(),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
}))

vi.mock('@/lib/admin-2fa', () => ({
  getAdminTwoFactorState: () => getAdminTwoFactorState(),
  confirmAdminTotpSetup: () => confirmAdminTotpSetup(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/admin-totp', () => ({
  normalizeTotpCode: (code: unknown) =>
    typeof code === 'string' && /^\d{6}$/.test(code.replace(/\s+/g, ''))
      ? code.replace(/\s+/g, '')
      : null,
  verifyTotpCode: (...args: unknown[]) => verifyTotpCode(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

describe('POST /api/admin/2fa/verify-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue(true)
    isDbConfigured.mockReturnValue(true)
    rateLimit.mockResolvedValue({ ok: true })
    confirmAdminTotpSetup.mockResolvedValue(undefined)
    logAdminAction.mockResolvedValue(undefined)
    verifyTotpCode.mockResolvedValue(true)
  })

  it('first setup verifies the stored secret and enables 2FA', async () => {
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: false,
      totpSecret: 'FIRSTSECRET',
      pendingTotpSecret: null,
    })
    const { POST } = await import('@/app/api/admin/2fa/verify-setup/route')
    const res = await POST(
      new Request('http://localhost/api/admin/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      })
    )
    expect(res.status).toBe(200)
    expect(verifyTotpCode).toHaveBeenCalledWith('FIRSTSECRET', '123456')
    expect(confirmAdminTotpSetup).toHaveBeenCalled()
    const data = await res.json()
    expect(data.isTwoFactorEnabled).toBe(true)
  })

  it('re-enroll verifies the pending secret, not the still-active one', async () => {
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: true,
      totpSecret: 'ACTIVESECRET',
      pendingTotpSecret: 'PENDINGSECRET',
    })
    const { POST } = await import('@/app/api/admin/2fa/verify-setup/route')
    const res = await POST(
      new Request('http://localhost/api/admin/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '654321' }),
      })
    )
    expect(res.status).toBe(200)
    expect(verifyTotpCode).toHaveBeenCalledWith('PENDINGSECRET', '654321')
    expect(verifyTotpCode).not.toHaveBeenCalledWith('ACTIVESECRET', expect.anything())
    expect(confirmAdminTotpSetup).toHaveBeenCalled()
  })

  it('rejects an invalid pending code without promoting the secret', async () => {
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: true,
      totpSecret: 'ACTIVESECRET',
      pendingTotpSecret: 'PENDINGSECRET',
    })
    verifyTotpCode.mockResolvedValue(false)
    const { POST } = await import('@/app/api/admin/2fa/verify-setup/route')
    const res = await POST(
      new Request('http://localhost/api/admin/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '000000' }),
      })
    )
    expect(res.status).toBe(401)
    expect(confirmAdminTotpSetup).not.toHaveBeenCalled()
  })
})
