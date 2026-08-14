import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdminOrPendingTwoFactor = vi.fn()
const isDbConfigured = vi.fn()
const getAdminTwoFactorState = vi.fn()
const confirmAdminTotpSetup = vi.fn()
const verifyTotpCode = vi.fn()
const rateLimit = vi.fn()
const logAdminAction = vi.fn()
const isAdminSessionConfigured = vi.fn()
const createAdminSessionToken = vi.fn()
const getAdminCookieOptions = vi.fn((..._args: unknown[]) => ({
  path: '/',
  maxAge: 60,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
}))

vi.mock('@/lib/admin-auth', () => ({
  requireAdminOrPendingTwoFactor: () => requireAdminOrPendingTwoFactor(),
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

vi.mock('@/lib/admin-session', () => ({
  ADMIN_COOKIE_NAME: 'admin_authorized',
  ADMIN_2FA_PENDING_COOKIE: 'admin_2fa_pending',
  isAdminSessionConfigured: () => isAdminSessionConfigured(),
  createAdminSessionToken: () => createAdminSessionToken(),
  getAdminCookieOptions: (maxAge?: number) => getAdminCookieOptions(maxAge),
}))

vi.mock('@/lib/admin-csrf', () => ({
  ADMIN_CSRF_COOKIE: 'admin_csrf',
  generateCsrfToken: () => 'csrf-token',
  getAdminCsrfCookieOptions: () => ({ path: '/', maxAge: 60, httpOnly: false, sameSite: 'strict' }),
}))

const evaluateAdminKeyPolicy = vi.fn()
const recordAdminKeyAccepted = vi.fn()
vi.mock('@/lib/admin-key-policy', () => ({
  MUST_CHANGE_KEY_MESSAGE: 'Az ADMIN_API_KEY-t cserélni kell.',
  evaluateAdminKeyPolicy: () => evaluateAdminKeyPolicy(),
  recordAdminKeyAccepted: () => recordAdminKeyAccepted(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('POST /api/admin/2fa/verify-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminOrPendingTwoFactor.mockResolvedValue('admin')
    isDbConfigured.mockReturnValue(true)
    isAdminSessionConfigured.mockReturnValue(true)
    rateLimit.mockResolvedValue({ ok: true })
    confirmAdminTotpSetup.mockResolvedValue(undefined)
    logAdminAction.mockResolvedValue(undefined)
    verifyTotpCode.mockResolvedValue(true)
    createAdminSessionToken.mockResolvedValue('full-admin-jwt')
    evaluateAdminKeyPolicy.mockResolvedValue({ ok: true, rotated: false })
    recordAdminKeyAccepted.mockResolvedValue(undefined)
    process.env.ADMIN_API_KEY = 'test-admin-key'
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
    expect(createAdminSessionToken).not.toHaveBeenCalled()
  })

  it('issues a full admin session after first-time setup with a pending login token', async () => {
    requireAdminOrPendingTwoFactor.mockResolvedValue('pending')
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
    expect(createAdminSessionToken).toHaveBeenCalled()
    expect(recordAdminKeyAccepted).toHaveBeenCalled()
    expect(res.headers.get('set-cookie') || '').toContain('admin_authorized=')
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
    expect(createAdminSessionToken).not.toHaveBeenCalled()
  })
})
