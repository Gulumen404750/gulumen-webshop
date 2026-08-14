import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const isDbConfigured = vi.fn()
const saveAdminTotpSetup = vi.fn()
const logAdminAction = vi.fn()
const generateTotpSecret = vi.fn()
const buildTotpAuthUrl = vi.fn()
const totpQrDataUrl = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => requireAdmin(),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
}))

vi.mock('@/lib/admin-2fa', () => ({
  saveAdminTotpSetup: (...args: unknown[]) => saveAdminTotpSetup(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/admin-totp', () => ({
  generateTotpSecret: () => generateTotpSecret(),
  buildTotpAuthUrl: (...args: unknown[]) => buildTotpAuthUrl(...args),
  totpQrDataUrl: (...args: unknown[]) => totpQrDataUrl(...args),
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
  })

  it('returns QR payload and stores secret with 2FA still disabled', async () => {
    const { POST } = await import('@/app/api/admin/2fa/setup/route')
    const res = await POST(new Request('http://localhost/api/admin/2fa/setup', { method: 'POST' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(data.qrDataUrl).toMatch(/^data:image\/png/)
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
