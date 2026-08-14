import { beforeEach, describe, expect, it, vi } from 'vitest'

const rateLimit = vi.fn()
const isAdminSessionConfigured = vi.fn()
const isDbConfigured = vi.fn()
const parseAdminPendingTwoFactorToken = vi.fn()
const createAdminSessionToken = vi.fn()
const getAdminCookieOptions = vi.fn((..._args: unknown[]) => ({
  path: '/',
  maxAge: 60,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
}))
const getAdminTwoFactorState = vi.fn()
const verifyTotpCode = vi.fn()
const logAdminAction = vi.fn()
const cookieGet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieGet(name),
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/admin-session', () => ({
  ADMIN_COOKIE_NAME: 'admin_authorized',
  ADMIN_2FA_PENDING_COOKIE: 'admin_2fa_pending',
  isAdminSessionConfigured: () => isAdminSessionConfigured(),
  parseAdminPendingTwoFactorToken: (...args: unknown[]) => parseAdminPendingTwoFactorToken(...args),
  parseAdminSessionToken: async () => null,
  createAdminSessionToken: () => createAdminSessionToken(),
  getAdminCookieOptions: (maxAge?: number) => getAdminCookieOptions(maxAge),
}))

vi.mock('@/lib/admin-csrf', () => ({
  ADMIN_CSRF_COOKIE: 'admin_csrf',
  generateCsrfToken: () => 'csrf-token',
  getAdminCsrfCookieOptions: () => ({ path: '/', maxAge: 60, httpOnly: false, sameSite: 'strict' }),
}))

vi.mock('@/lib/admin-2fa', () => ({
  getAdminTwoFactorState: () => getAdminTwoFactorState(),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
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

const recordAdminLoginFingerprintSafe = vi.fn()
vi.mock('@/lib/admin-login-alert', () => ({
  recordAdminLoginFingerprintSafe: (...args: unknown[]) => recordAdminLoginFingerprintSafe(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const evaluateAdminKeyPolicy = vi.fn()
const recordAdminKeyAccepted = vi.fn()
vi.mock('@/lib/admin-key-policy', () => ({
  MUST_CHANGE_KEY_MESSAGE: 'Az ADMIN_API_KEY-t cserélni kell.',
  evaluateAdminKeyPolicy: () => evaluateAdminKeyPolicy(),
  recordAdminKeyAccepted: () => recordAdminKeyAccepted(),
}))

describe('POST /api/admin/2fa/verify-login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ ok: true })
    isAdminSessionConfigured.mockReturnValue(true)
    isDbConfigured.mockReturnValue(true)
    cookieGet.mockReturnValue({ value: 'pending-jwt' })
    parseAdminPendingTwoFactorToken.mockResolvedValue({
      id: 'admin',
      username: 'admin',
      role: 'owner',
      bootstrap: true,
    })
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: true,
      totpSecret: 'SECRET',
    })
    verifyTotpCode.mockResolvedValue(true)
    createAdminSessionToken.mockResolvedValue('full-admin-jwt')
    logAdminAction.mockResolvedValue(undefined)
    recordAdminLoginFingerprintSafe.mockResolvedValue(undefined)
    evaluateAdminKeyPolicy.mockResolvedValue({ ok: true, rotated: false })
    recordAdminKeyAccepted.mockResolvedValue(undefined)
    process.env.ADMIN_API_KEY = 'test-admin-key'
  })

  it('issues the admin cookie when pending token and TOTP are valid', async () => {
    const { POST } = await import('@/app/api/admin/2fa/verify-login/route')
    const res = await POST(
      new Request('http://localhost/api/admin/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      })
    )
    expect(res.status).toBe(200)
    expect(createAdminSessionToken).toHaveBeenCalled()
    expect(recordAdminKeyAccepted).toHaveBeenCalled()
    expect(res.headers.get('set-cookie') || '').toContain('admin_authorized=')
    expect(recordAdminLoginFingerprintSafe).toHaveBeenCalled()
  })

  it('rejects 2FA completion when mustChangeKey is set for the current key', async () => {
    evaluateAdminKeyPolicy.mockResolvedValue({ ok: false, reason: 'must_change_key' })
    const { POST } = await import('@/app/api/admin/2fa/verify-login/route')
    const res = await POST(
      new Request('http://localhost/api/admin/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      })
    )
    expect(res.status).toBe(403)
    expect(createAdminSessionToken).not.toHaveBeenCalled()
    expect(recordAdminKeyAccepted).not.toHaveBeenCalled()
  })

  it('rejects an invalid TOTP code without issuing a session', async () => {
    verifyTotpCode.mockResolvedValue(false)
    const { POST } = await import('@/app/api/admin/2fa/verify-login/route')
    const res = await POST(
      new Request('http://localhost/api/admin/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '000000' }),
      })
    )
    expect(res.status).toBe(401)
    expect(createAdminSessionToken).not.toHaveBeenCalled()
    expect(recordAdminLoginFingerprintSafe).not.toHaveBeenCalled()
  })
})
