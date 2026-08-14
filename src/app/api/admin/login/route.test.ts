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
const authenticateAdminOperator = vi.fn()

const OWNER = { id: 'op1', username: 'alice', role: 'owner' }

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/admin-session', () => ({
  ADMIN_COOKIE_NAME: 'admin_authorized',
  ADMIN_2FA_PENDING_COOKIE: 'admin_2fa_pending',
  ADMIN_2FA_PENDING_MAX_AGE_SEC: 300,
  isAdminSessionConfigured: () => isAdminSessionConfigured(),
  createAdminSessionToken: (...args: unknown[]) => createAdminSessionToken(...args),
  createAdminPendingTwoFactorToken: (...args: unknown[]) => createAdminPendingTwoFactorToken(...args),
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

vi.mock('@/lib/admin-operators', () => ({
  authenticateAdminOperator: (...args: unknown[]) => authenticateAdminOperator(...args),
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

function loginBody(extra: Record<string, string> = {}) {
  return JSON.stringify({
    key: 'test-admin-key',
    username: 'alice',
    password: 'longenough1',
    ...extra,
  })
}

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
    authenticateAdminOperator.mockResolvedValue({ ok: true, actor: OWNER, created: false })
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
        body: loginBody(),
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.requiresTwoFactor).toBe(true)
    expect(data.username).toBe('alice')
    expect(res.headers.get('set-cookie') || '').toContain('admin_2fa_pending=')
    expect(res.headers.get('set-cookie') || '').not.toContain('admin_authorized=')
    expect(createAdminSessionToken).not.toHaveBeenCalled()
    expect(createAdminPendingTwoFactorToken).toHaveBeenCalledWith(OWNER)
  })

  it('issues a full admin cookie bound to the operator when 2FA is off', async () => {
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: false, totpSecret: null })
    const { POST } = await import('@/app/api/admin/login/route')
    const res = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: loginBody(),
      })
    )
    const data = await res.json()
    expect(data.requiresTwoFactor).toBe(false)
    expect(data.role).toBe('owner')
    expect(createAdminSessionToken).toHaveBeenCalledWith(OWNER)
    expect(res.headers.get('set-cookie') || '').toContain('admin_authorized=')
  })

  it('rejects a valid API key without operator credentials', async () => {
    authenticateAdminOperator.mockResolvedValue({ ok: false, reason: 'invalid' })
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: false, totpSecret: null })
    const { POST } = await import('@/app/api/admin/login/route')
    const res = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'test-admin-key' }),
      })
    )
    expect(res.status).toBe(401)
    expect(createAdminSessionToken).not.toHaveBeenCalled()
  })
})
