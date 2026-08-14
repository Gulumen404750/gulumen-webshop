import { afterEach, describe, expect, it } from 'vitest'
import { getAdminApiKeyClaim, getAdminSessionVersion } from './admin-session-version'
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

  it('ak claim follows ADMIN_API_KEY and ignores JWT_SECRET', async () => {
    const a = await getAdminApiKeyClaim({ ADMIN_API_KEY: 'key-a' })
    const b = await getAdminApiKeyClaim({ ADMIN_API_KEY: 'key-b' })
    const sameKeyDifferentJwt = await getAdminApiKeyClaim({ ADMIN_API_KEY: 'key-a' })
    expect(a).not.toBe(b)
    expect(a).toBe(sameKeyDifferentJwt)
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
    const token = await createAdminSessionToken()
    expect(await verifyAdminSessionToken(token)).toBe(true)

    process.env.ADMIN_API_KEY = 'rotated-admin-key'
    expect(await verifyAdminSessionToken(token)).toBe(false)
  })

  it('invalidates cookies after JWT_SECRET rotation', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const token = await createAdminSessionToken()
    expect(await verifyAdminSessionToken(token)).toBe(true)

    process.env.JWT_SECRET = 'rotated-jwt-secret-16+'
    expect(await verifyAdminSessionToken(token)).toBe(false)
  })

  it('rejects a JWT that is signed correctly but has no ak (API key) claim', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const { SignJWT } = await import('jose')
    const { getAdminSessionVersion } = await import('./admin-session-version')
    const {
      JWT_ISSUER,
      JWT_AUDIENCE,
      ADMIN_SESSION_VERSION_CLAIM,
      ADMIN_SESSION_MAX_AGE_SEC,
      ADMIN_TFA_CLAIM,
    } = await import('./admin-session-constants')
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const now = Math.floor(Date.now() / 1000)
    const sv = await getAdminSessionVersion()
    const token = await new SignJWT({
      role: 'admin',
      [ADMIN_SESSION_VERSION_CLAIM]: sv,
      [ADMIN_TFA_CLAIM]: true,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + ADMIN_SESSION_MAX_AGE_SEC)
      .sign(secret)
    expect(await verifyAdminSessionToken(token)).toBe(false)
  })

  it('does not treat a pending 2FA token as a full admin session', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const pending = await createAdminPendingTwoFactorToken()
    expect(await verifyAdminPendingTwoFactorToken(pending)).toBe(true)
    expect(await verifyAdminSessionToken(pending)).toBe(false)
  })

  it('rejects a pending 2FA JWT without ak after ADMIN_API_KEY rotation', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'original-admin-key'
    const pending = await createAdminPendingTwoFactorToken()
    expect(await verifyAdminPendingTwoFactorToken(pending)).toBe(true)
    process.env.ADMIN_API_KEY = 'rotated-admin-key'
    expect(await verifyAdminPendingTwoFactorToken(pending)).toBe(false)
  })

  it('rejects a full session JWT that was not issued after 2FA', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const { SignJWT } = await import('jose')
    const { getAdminSessionVersion } = await import('./admin-session-version')
    const {
      JWT_ISSUER,
      JWT_AUDIENCE,
      ADMIN_SESSION_VERSION_CLAIM,
    } = await import('./admin-session-constants')
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
    const withTfa = await createAdminSessionToken()
    expect(await verifyAdminSessionToken(withTfa)).toBe(true)
  })

  it('rejects a session after idle timeout and after logout revoke', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const { SignJWT } = await import('jose')
    const { getAdminSessionVersion } = await import('./admin-session-version')
    const {
      JWT_ISSUER,
      JWT_AUDIENCE,
      ADMIN_SESSION_VERSION_CLAIM,
      ADMIN_TFA_CLAIM,
      ADMIN_SESSION_JTI_CLAIM,
      ADMIN_SESSION_ACTIVITY_CLAIM,
    } = await import('./admin-session-constants')
    const now = Math.floor(Date.now() / 1000)
    const sv = await getAdminSessionVersion()
    const idleToken = await new SignJWT({
      role: 'owner',
      [ADMIN_SESSION_VERSION_CLAIM]: sv,
      [ADMIN_TFA_CLAIM]: true,
      [ADMIN_SESSION_JTI_CLAIM]: 'a'.repeat(32),
      [ADMIN_SESSION_ACTIVITY_CLAIM]: now - 31 * 60,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt(now - 31 * 60)
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET))
    expect(await verifyAdminSessionToken(idleToken)).toBe(false)

    const { revokeAdminSessionToken } = await import('./admin-session')
    const live = await createAdminSessionToken()
    expect(await verifyAdminSessionToken(live)).toBe(true)
    await revokeAdminSessionToken(live)
    expect(await verifyAdminSessionToken(live)).toBe(false)
  })

  it('issues operator JWTs that Edge and Node both accept', async () => {
    process.env.JWT_SECRET = 'jwt-secret-at-least-16-chars'
    process.env.ADMIN_API_KEY = 'admin-key'
    const actor = { id: 'op-support-1', username: 'kata', role: 'support' as const }
    const token = await createAdminSessionToken(actor)
    expect(await verifyAdminSessionToken(token)).toBe(true)
    const { parseAdminSessionToken } = await import('./admin-session')
    expect(await parseAdminSessionToken(token)).toEqual(
      expect.objectContaining({ id: 'op-support-1', username: 'kata', role: 'support' })
    )
    const { verifyAdminSessionToken: verifyEdge } = await import('./admin-session-edge')
    expect(await verifyEdge(token)).toBe(true)
  })
})
