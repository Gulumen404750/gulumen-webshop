import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const isDbConfigured = vi.fn()
const isAdminSessionConfigured = vi.fn()
const rateLimit = vi.fn()
const logAdminAction = vi.fn()
const getAdminPasswordState = vi.fn()
const getAdminTwoFactorState = vi.fn()
const validateAdminPassword = vi.fn()
const verifyAdminPassword = vi.fn()
const hashAdminPassword = vi.fn()
const saveAdminPasswordHash = vi.fn()
const bumpAdminSessionEpoch = vi.fn()
const createAdminSessionToken = vi.fn()
const verifyTotpCode = vi.fn()
const normalizeTotpCode = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => requireAdmin(),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/admin-password', () => ({
  getAdminPasswordState: () => getAdminPasswordState(),
  validateAdminPassword: (...args: unknown[]) => validateAdminPassword(...args),
  verifyAdminPassword: (...args: unknown[]) => verifyAdminPassword(...args),
  hashAdminPassword: (...args: unknown[]) => hashAdminPassword(...args),
  saveAdminPasswordHash: (...args: unknown[]) => saveAdminPasswordHash(...args),
}))

vi.mock('@/lib/admin-2fa', () => ({
  getAdminTwoFactorState: () => getAdminTwoFactorState(),
}))

vi.mock('@/lib/admin-totp', () => ({
  normalizeTotpCode: (value: unknown) => normalizeTotpCode(value),
  verifyTotpCode: (...args: unknown[]) => verifyTotpCode(...args),
}))

vi.mock('@/lib/admin-session-epoch', () => ({
  bumpAdminSessionEpoch: () => bumpAdminSessionEpoch(),
}))

vi.mock('@/lib/admin-session', () => ({
  ADMIN_COOKIE_NAME: 'admin_authorized',
  isAdminSessionConfigured: () => isAdminSessionConfigured(),
  createAdminSessionToken: () => createAdminSessionToken(),
  getAdminCookieOptions: () => ({ path: '/', httpOnly: true, sameSite: 'lax', secure: false }),
}))

vi.mock('@/lib/admin-csrf', () => ({
  ADMIN_CSRF_COOKIE: 'admin_csrf',
  generateCsrfToken: () => 'csrf-token',
  getAdminCsrfCookieOptions: () => ({ path: '/', httpOnly: false, sameSite: 'strict' }),
}))

describe('/api/admin/password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue(true)
    isDbConfigured.mockReturnValue(true)
    isAdminSessionConfigured.mockReturnValue(true)
    rateLimit.mockResolvedValue({ ok: true })
    logAdminAction.mockResolvedValue(undefined)
    getAdminPasswordState.mockResolvedValue({ passwordHash: null, passwordSetAt: null })
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: true, totpSecret: 'SECRET' })
    validateAdminPassword.mockReturnValue({ ok: true })
    hashAdminPassword.mockResolvedValue('new-hash')
    saveAdminPasswordHash.mockResolvedValue(undefined)
    bumpAdminSessionEpoch.mockResolvedValue(1)
    createAdminSessionToken.mockResolvedValue('new-jwt')
    normalizeTotpCode.mockImplementation((value: unknown) =>
      typeof value === 'string' && /^\d{6}$/.test(value) ? value : null
    )
    verifyTotpCode.mockResolvedValue(true)
  })

  it('GET never returns the password hash', async () => {
    getAdminPasswordState.mockResolvedValue({
      passwordHash: 'bcrypt-hash-secret',
      passwordSetAt: new Date('2026-08-14T00:00:00Z'),
    })
    const { GET } = await import('@/app/api/admin/password/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.passwordSet).toBe(true)
    expect(data.passwordHash).toBeUndefined()
    expect(JSON.stringify(data)).not.toContain('bcrypt-hash-secret')
  })

  it('POST requires TOTP when 2FA is on', async () => {
    const { POST } = await import('@/app/api/admin/password/route')
    const res = await POST(
      new Request('http://localhost/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: 'CorrectHorse1' }),
      })
    )
    expect(res.status).toBe(401)
    expect(saveAdminPasswordHash).not.toHaveBeenCalled()
  })
})
