import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAdminSessionVersion } from './admin-session-version'

const getAdminSessionEpoch = vi.fn()

vi.mock('@/lib/admin-session-epoch', () => ({
  getAdminSessionEpoch: () => getAdminSessionEpoch(),
}))

const ORIGINAL_ENV = {
  JWT_SECRET: process.env.JWT_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
}

describe('admin session version', () => {
  beforeEach(() => {
    getAdminSessionEpoch.mockReset()
    getAdminSessionEpoch.mockResolvedValue(0)
  })

  afterEach(() => {
    process.env.JWT_SECRET = ORIGINAL_ENV.JWT_SECRET
    process.env.NEXTAUTH_SECRET = ORIGINAL_ENV.NEXTAUTH_SECRET
    process.env.ADMIN_API_KEY = ORIGINAL_ENV.ADMIN_API_KEY
  })

  it('changes when ADMIN_API_KEY changes', async () => {
    const a = await getAdminSessionVersion({
      JWT_SECRET: 'jwt-secret-at-least-16',
      ADMIN_API_KEY: 'key-a',
    })
    const b = await getAdminSessionVersion({
      JWT_SECRET: 'jwt-secret-at-least-16',
      ADMIN_API_KEY: 'key-b',
    })
    expect(a).not.toBe(b)
  })

  it('changes when JWT_SECRET changes', async () => {
    const a = await getAdminSessionVersion({
      JWT_SECRET: 'jwt-secret-at-least-16',
      ADMIN_API_KEY: 'same-key',
    })
    const b = await getAdminSessionVersion({
      JWT_SECRET: 'other-secret-16ch+',
      ADMIN_API_KEY: 'same-key',
    })
    expect(a).not.toBe(b)
  })

  it('invalidates cookies after ADMIN_API_KEY rotation', async () => {
    const {
      createAdminSessionToken,
      verifyAdminSessionToken,
    } = await import('./admin-session')
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'original-admin-key'
    const token = await createAdminSessionToken()
    expect(await verifyAdminSessionToken(token)).toBe(true)

    process.env.ADMIN_API_KEY = 'rotated-admin-key'
    expect(await verifyAdminSessionToken(token)).toBe(false)
  })

  it('invalidates cookies after JWT_SECRET rotation', async () => {
    const {
      createAdminSessionToken,
      verifyAdminSessionToken,
    } = await import('./admin-session')
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const token = await createAdminSessionToken()
    expect(await verifyAdminSessionToken(token)).toBe(true)

    process.env.JWT_SECRET = 'rotated-jwt-secret-16+'
    expect(await verifyAdminSessionToken(token)).toBe(false)
  })

  it('invalidates cookies after password-reset session epoch bump', async () => {
    const {
      createAdminSessionToken,
      verifyAdminSessionToken,
    } = await import('./admin-session')
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    getAdminSessionEpoch.mockResolvedValue(0)
    const token = await createAdminSessionToken()
    expect(await verifyAdminSessionToken(token)).toBe(true)

    getAdminSessionEpoch.mockResolvedValue(1)
    expect(await verifyAdminSessionToken(token)).toBe(false)
  })

  it('does not treat a pending 2FA token as a full admin session', async () => {
    const {
      createAdminPendingTwoFactorToken,
      verifyAdminPendingTwoFactorToken,
      verifyAdminSessionToken,
    } = await import('./admin-session')
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const pending = await createAdminPendingTwoFactorToken()
    expect(await verifyAdminPendingTwoFactorToken(pending)).toBe(true)
    expect(await verifyAdminSessionToken(pending)).toBe(false)
  })
})
