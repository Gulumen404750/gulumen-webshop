import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rateLimit = vi.fn()
const isAdminSessionConfigured = vi.fn()
const createAdminSessionToken = vi.fn()
const createAdminPendingTwoFactorToken = vi.fn()
const getAdminCookieOptions = vi.fn((..._args: unknown[]) => ({ path: '/', maxAge: 60, httpOnly: true, sameSite: 'lax' as const, secure: false }))
const getAdminTwoFactorState = vi.fn()
const isDbConfigured = vi.fn()
const logAdminAction = vi.fn()
const secureCompare = vi.fn()

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/admin-session', () => ({
  ADMIN_COOKIE_NAME: 'admin_authorized',
  ADMIN_2FA_PENDING_COOKIE: 'admin_2fa_pending',
  ADMIN_2FA_PENDING_MAX_AGE_SEC: 300,
  isAdminSessionConfigured: () => isAdminSessionConfigured(),
  createAdminSessionToken: () => createAdminSessionToken(),
  createAdminPendingTwoFactorToken: () => createAdminPendingTwoFactorToken(),
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

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/secure-compare', () => ({
  secureCompare: (...args: unknown[]) => secureCompare(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const evaluateAdminKeyPolicy = vi.fn()
const recordAdminKeyAccepted = vi.fn()
vi.mock('@/lib/admin-key-policy', () => ({
  MUST_CHANGE_KEY_MESSAGE: 'Az ADMIN_API_KEY-t cserélni kell.',
  evaluateAdminKeyPolicy: () => evaluateAdminKeyPolicy(),
  recordAdminKeyAccepted: () => recordAdminKeyAccepted(),
}))

describe('POST /api/admin/login 2FA gate', () => {
  const originalKey = process.env.ADMIN_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_API_KEY = 'test-admin-key'
    rateLimit.mockResolvedValue({ ok: true })
    isAdminSessionConfigured.mockReturnValue(true)
    isDbConfigured.mockReturnValue(true)
    secureCompare.mockReturnValue(true)
    logAdminAction.mockResolvedValue(undefined)
    createAdminSessionToken.mockResolvedValue('full-admin-jwt')
    createAdminPendingTwoFactorToken.mockResolvedValue('pending-2fa-jwt')
    evaluateAdminKeyPolicy.mockResolvedValue({ ok: true, rotated: false })
    recordAdminKeyAccepted.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env.ADMIN_API_KEY = originalKey
  })

  it('issues a pending 2FA cookie instead of a full session when 2FA is enabled', async () => {
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: true, totpSecret: 'SECRET' })
    const { POST } = await import('@/app/api/admin/login/route')
    const res = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'test-admin-key' }),
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.requiresTwoFactor).toBe(true)
    expect(res.headers.get('set-cookie') || '').toContain('admin_2fa_pending=')
    expect(res.headers.get('set-cookie') || '').not.toContain('admin_authorized=')
    expect(createAdminSessionToken).not.toHaveBeenCalled()
  })

  it('issues a full admin cookie when 2FA is off', async () => {
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: false, totpSecret: null })
    const { POST } = await import('@/app/api/admin/login/route')
    const res = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'test-admin-key' }),
      })
    )
    const data = await res.json()
    expect(data.requiresTwoFactor).toBe(false)
    expect(createAdminSessionToken).toHaveBeenCalled()
    expect(res.headers.get('set-cookie') || '').toContain('admin_authorized=')
    expect(recordAdminKeyAccepted).toHaveBeenCalled()
  })

  it('rejects login with the current key when mustChangeKey is set', async () => {
    evaluateAdminKeyPolicy.mockResolvedValue({ ok: false, reason: 'must_change_key' })
    const { POST } = await import('@/app/api/admin/login/route')
    const res = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'test-admin-key' }),
      })
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('must_change_key')
    expect(createAdminSessionToken).not.toHaveBeenCalled()
    expect(createAdminPendingTwoFactorToken).not.toHaveBeenCalled()
  })
})
