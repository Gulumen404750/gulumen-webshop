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
    expect(res.headers.get('set-cookie') || '').toContain('admin_authorized=')
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
  })
})
