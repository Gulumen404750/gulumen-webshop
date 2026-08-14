import { afterEach, describe, expect, it } from 'vitest'
import { getAdminSessionVersion } from './admin-session-version'
import {
  createAdminSessionToken,
  createAdminPendingTwoFactorToken,
  verifyAdminSessionToken,
  verifyAdminPendingTwoFactorToken,
} from './admin-session'

const ORIGINAL_ENV = {
  JWT_SECRET: process.env.JWT_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
}

describe('admin session version', () => {
  const OWNER = { id: 'op1', username: 'owner', role: 'owner' as const }

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
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'original-admin-key'
    const token = await createAdminSessionToken(OWNER)
    expect(await verifyAdminSessionToken(token)).toBe(true)

    process.env.ADMIN_API_KEY = 'rotated-admin-key'
    expect(await verifyAdminSessionToken(token)).toBe(false)
  })

  it('invalidates cookies after JWT_SECRET rotation', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const token = await createAdminSessionToken(OWNER)
    expect(await verifyAdminSessionToken(token)).toBe(true)

    process.env.JWT_SECRET = 'rotated-jwt-secret-16+'
    expect(await verifyAdminSessionToken(token)).toBe(false)
  })

  it('does not treat a pending 2FA token as a full admin session', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const pending = await createAdminPendingTwoFactorToken(OWNER)
    expect(await verifyAdminPendingTwoFactorToken(pending)).toBe(true)
    expect(await verifyAdminSessionToken(pending)).toBe(false)
  })

  it('rejects legacy shared admin JWTs without an operator identity', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const { SignJWT } = await import('jose')
    const { getAdminSessionVersion } = await import('./admin-session-version')
    const { JWT_ISSUER, JWT_AUDIENCE, ADMIN_SESSION_VERSION_CLAIM } = await import(
      './admin-session-constants'
    )
    const now = Math.floor(Date.now() / 1000)
    const sv = await getAdminSessionVersion()
    const token = await new SignJWT({ role: 'admin', [ADMIN_SESSION_VERSION_CLAIM]: sv })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET))
    expect(await verifyAdminSessionToken(token)).toBe(false)
    expect(await verifyAdminSessionToken(await createAdminSessionToken(OWNER))).toBe(true)
  })
})
