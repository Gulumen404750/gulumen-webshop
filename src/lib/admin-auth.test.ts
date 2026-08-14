import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieGet = vi.fn()
const verifyAdminSessionToken = vi.fn()
const verifyAdminPendingTwoFactorToken = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieGet(name),
  }),
}))

vi.mock('@/lib/admin-session', () => ({
  ADMIN_COOKIE_NAME: 'admin_authorized',
  ADMIN_2FA_PENDING_COOKIE: 'admin_2fa_pending',
  verifyAdminSessionToken: (...args: unknown[]) => verifyAdminSessionToken(...args),
  verifyAdminPendingTwoFactorToken: (...args: unknown[]) => verifyAdminPendingTwoFactorToken(...args),
}))

describe('requireAdmin / requireAdminOrPendingTwoFactor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieGet.mockReturnValue(undefined)
    verifyAdminSessionToken.mockResolvedValue(false)
    verifyAdminPendingTwoFactorToken.mockResolvedValue(false)
  })

  it('requireAdmin accepts only a full 2FA session', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === 'admin_authorized' ? { value: 'full-jwt' } : undefined
    )
    verifyAdminSessionToken.mockResolvedValue(true)
    const { requireAdmin } = await import('./admin-auth')
    expect(await requireAdmin()).toBe(true)
  })

  it('pending 2FA token is not enough for requireAdmin', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === 'admin_2fa_pending' ? { value: 'pending-jwt' } : undefined
    )
    verifyAdminPendingTwoFactorToken.mockResolvedValue(true)
    const { requireAdmin, requireAdminOrPendingTwoFactor } = await import('./admin-auth')
    expect(await requireAdmin()).toBe(false)
    expect(await requireAdminOrPendingTwoFactor()).toBe('pending')
  })
})
