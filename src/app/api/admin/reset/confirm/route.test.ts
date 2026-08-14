import { beforeEach, describe, expect, it, vi } from 'vitest'

const rateLimit = vi.fn()
const logAdminAction = vi.fn()
const isDbConfigured = vi.fn()
const findAdminForPasswordReset = vi.fn()
const isAdminResetTokenExpired = vi.fn()
const resetTokenMatches = vi.fn()
const clearAdminResetToken = vi.fn()
const getAdminTwoFactorState = vi.fn()
const verifyTotpCode = vi.fn()
const normalizeTotpCode = vi.fn()
const hashAdminPassword = vi.fn()
const validateAdminPassword = vi.fn()
const bumpAdminSessionEpoch = vi.fn()
const prismaUpdate = vi.fn()

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: { admin: { update: (...args: unknown[]) => prismaUpdate(...args) } },
}))

vi.mock('@/lib/admin-password-reset', () => ({
  findAdminForPasswordReset: () => findAdminForPasswordReset(),
  isAdminResetTokenExpired: (...args: unknown[]) => isAdminResetTokenExpired(...args),
  resetTokenMatches: (...args: unknown[]) => resetTokenMatches(...args),
  clearAdminResetToken: () => clearAdminResetToken(),
}))

vi.mock('@/lib/admin-2fa', () => ({
  getAdminTwoFactorState: () => getAdminTwoFactorState(),
}))

vi.mock('@/lib/admin-totp', () => ({
  normalizeTotpCode: (value: unknown) => normalizeTotpCode(value),
  verifyTotpCode: (...args: unknown[]) => verifyTotpCode(...args),
}))

vi.mock('@/lib/admin-password', () => ({
  hashAdminPassword: (...args: unknown[]) => hashAdminPassword(...args),
  validateAdminPassword: (...args: unknown[]) => validateAdminPassword(...args),
}))

vi.mock('@/lib/admin-session-epoch', () => ({
  bumpAdminSessionEpoch: () => bumpAdminSessionEpoch(),
}))

vi.mock('@/lib/admin-session', () => ({
  ADMIN_COOKIE_NAME: 'admin_authorized',
  ADMIN_2FA_PENDING_COOKIE: 'admin_2fa_pending',
  getAdminCookieOptions: () => ({ path: '/', httpOnly: true, sameSite: 'lax', secure: false }),
}))

vi.mock('@/lib/admin-csrf', () => ({
  ADMIN_CSRF_COOKIE: 'admin_csrf',
  getAdminCsrfCookieOptions: () => ({ path: '/', httpOnly: false, sameSite: 'strict' }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

function confirmRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/reset/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ ok: true })
    isDbConfigured.mockReturnValue(true)
    logAdminAction.mockResolvedValue(undefined)
    validateAdminPassword.mockReturnValue({ ok: true })
    hashAdminPassword.mockResolvedValue('new-hash')
    bumpAdminSessionEpoch.mockResolvedValue(1)
    prismaUpdate.mockResolvedValue({})
    clearAdminResetToken.mockResolvedValue(undefined)
    normalizeTotpCode.mockImplementation((value: unknown) =>
      typeof value === 'string' && /^\d{6}$/.test(value) ? value : null
    )
    findAdminForPasswordReset.mockResolvedValue({
      passwordHash: 'old-hash',
      passwordResetTokenHash: 'stored-hash',
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
      isTwoFactorEnabled: false,
      totpSecret: null,
    })
    resetTokenMatches.mockReturnValue(true)
    isAdminResetTokenExpired.mockReturnValue(false)
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: false, totpSecret: null })
  })

  it('rejects confirm when 2FA is on and TOTP is missing', async () => {
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: true, totpSecret: 'SECRET' })
    const { POST } = await import('@/app/api/admin/reset/confirm/route')
    const res = await POST(confirmRequest({ token: 'raw-token', password: 'CorrectHorse1' }))
    expect(res.status).toBe(401)
    expect(prismaUpdate).not.toHaveBeenCalled()
    expect(bumpAdminSessionEpoch).not.toHaveBeenCalled()
  })

  it('rejects confirm when 2FA is on and TOTP is wrong without consuming the token', async () => {
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: true, totpSecret: 'SECRET' })
    verifyTotpCode.mockResolvedValue(false)
    const { POST } = await import('@/app/api/admin/reset/confirm/route')
    const res = await POST(
      confirmRequest({ token: 'raw-token', password: 'CorrectHorse1', totpCode: '000000' })
    )
    expect(res.status).toBe(401)
    expect(prismaUpdate).not.toHaveBeenCalled()
    expect(bumpAdminSessionEpoch).not.toHaveBeenCalled()
  })

  it('sets the password, bumps session epoch, and requires TOTP when 2FA is on', async () => {
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: true, totpSecret: 'SECRET' })
    verifyTotpCode.mockResolvedValue(true)
    const { POST } = await import('@/app/api/admin/reset/confirm/route')
    const res = await POST(
      confirmRequest({ token: 'raw-token', password: 'CorrectHorse1', totpCode: '123456' })
    )
    expect(res.status).toBe(200)
    expect(verifyTotpCode).toHaveBeenCalledWith('SECRET', '123456')
    expect(prismaUpdate).toHaveBeenCalled()
    expect(bumpAdminSessionEpoch).toHaveBeenCalled()
  })

  it('returns a generic error for a bad token', async () => {
    resetTokenMatches.mockReturnValue(false)
    const { POST } = await import('@/app/api/admin/reset/confirm/route')
    const res = await POST(confirmRequest({ token: 'bad', password: 'CorrectHorse1' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('A link érvénytelen vagy lejárt.')
    expect(bumpAdminSessionEpoch).not.toHaveBeenCalled()
  })
})
