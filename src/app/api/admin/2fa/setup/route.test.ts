import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const isDbConfigured = vi.fn()
const saveAdminTotpSetup = vi.fn()
const getAdminTwoFactorState = vi.fn()
const logAdminAction = vi.fn()
const generateTotpSecret = vi.fn()
const buildTotpAuthUrl = vi.fn()
const totpQrDataUrl = vi.fn()
const verifyTotpCode = vi.fn()
const rateLimit = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => requireAdmin(),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
}))

vi.mock('@/lib/admin-2fa', () => ({
  saveAdminTotpSetup: (...args: unknown[]) => saveAdminTotpSetup(...args),
  getAdminTwoFactorState: () => getAdminTwoFactorState(),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/admin-totp', () => ({
  generateTotpSecret: () => generateTotpSecret(),
  buildTotpAuthUrl: (...args: unknown[]) => buildTotpAuthUrl(...args),
  totpQrDataUrl: (...args: unknown[]) => totpQrDataUrl(...args),
  normalizeTotpCode: (code: unknown) =>
    typeof code === 'string' && /^\d{6}$/.test(code.replace(/\s+/g, ''))
      ? code.replace(/\s+/g, '')
      : null,
  verifyTotpCode: (...args: unknown[]) => verifyTotpCode(...args),
}))

describe('POST /api/admin/2fa/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue(true)
    isDbConfigured.mockReturnValue(true)
    generateTotpSecret.mockReturnValue('JBSWY3DPEHPK3PXP')
    buildTotpAuthUrl.mockReturnValue('otpauth://totp/Gulumen:admin?secret=JBSWY3DPEHPK3PXP')
    totpQrDataUrl.mockResolvedValue('data:image/png;base64,AAA')
    saveAdminTotpSetup.mockResolvedValue(undefined)
    logAdminAction.mockResolvedValue(undefined)
    rateLimit.mockResolvedValue({ ok: true })
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: false,
      totpSecret: null,
      pendingTotpSecret: null,
    })
  })

  it('first setup returns QR payload and stores secret with 2FA still disabled', async () => {
    const { POST } = await import('@/app/api/admin/2fa/setup/route')
    const res = await POST(new Request('http://localhost/api/admin/2fa/setup', { method: 'POST' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(data.qrDataUrl).toMatch(/^data:image\/png/)
    expect(data.isTwoFactorEnabled).toBe(false)
    expect(saveAdminTotpSetup).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP')
    expect(verifyTotpCode).not.toHaveBeenCalled()
  })

  it('requires a valid current TOTP before re-enroll and does not overwrite without it', async () => {
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: true,
      totpSecret: 'ACTIVESECRET',
      pendingTotpSecret: null,
    })
    const { POST } = await import('@/app/api/admin/2fa/setup/route')
    const res = await POST(new Request('http://localhost/api/admin/2fa/setup', { method: 'POST' }))
    expect(res.status).toBe(400)
    expect(saveAdminTotpSetup).not.toHaveBeenCalled()
  })

  it('rejects an invalid step-up TOTP on re-enroll', async () => {
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: true,
      totpSecret: 'ACTIVESECRET',
      pendingTotpSecret: null,
    })
    verifyTotpCode.mockResolvedValue(false)
    const { POST } = await import('@/app/api/admin/2fa/setup/route')
    const res = await POST(
      new Request('http://localhost/api/admin/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '000000' }),
      })
    )
    expect(res.status).toBe(401)
    expect(verifyTotpCode).toHaveBeenCalledWith('ACTIVESECRET', '000000')
    expect(saveAdminTotpSetup).not.toHaveBeenCalled()
  })

  it('stores a pending secret after a valid step-up TOTP and reports 2FA still enabled', async () => {
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: true,
      totpSecret: 'ACTIVESECRET',
      pendingTotpSecret: null,
    })
    verifyTotpCode.mockResolvedValue(true)
    const { POST } = await import('@/app/api/admin/2fa/setup/route')
    const res = await POST(
      new Request('http://localhost/api/admin/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.isTwoFactorEnabled).toBe(true)
    expect(verifyTotpCode).toHaveBeenCalledWith('ACTIVESECRET', '123456')
    expect(saveAdminTotpSetup).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP')
  })

  it('returns 401 when not admin', async () => {
    requireAdmin.mockResolvedValue(false)
    const { POST } = await import('@/app/api/admin/2fa/setup/route')
    const res = await POST(new Request('http://localhost/api/admin/2fa/setup', { method: 'POST' }))
    expect(res.status).toBe(401)
    expect(saveAdminTotpSetup).not.toHaveBeenCalled()
  })
})
