/**
 * Aláírt admin session cookie (JWT/HMAC): sub, iat, exp, sv, jti, act, tfa.
 * Logout: jti denylist. Inaktivitás: act claim (30 perc).
 */

import { SignJWT, jwtVerify } from 'jose'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_AUDIENCE_2FA,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_TFA_CLAIM,
  ADMIN_2FA_PENDING_ROLE,
} from '@/lib/admin-session-constants'
import { getAdminSessionVersion } from '@/lib/admin-session-version'
import {
  isAdminSessionConfigured,
  readAdminSessionPayload,
  signAdminSessionToken,
} from '@/lib/admin-session-jwt'
import { isAdminSessionRevoked, revokeAdminSessionJti } from '@/lib/admin-session-revoke'
import { dbIsAdminSessionRevoked, persistRevokedAdminJti } from '@/lib/admin-session-revoke-db'

export {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
}

export { isAdminSessionConfigured, signAdminSessionToken as createAdminSessionToken }

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  const payload = await readAdminSessionPayload(token)
  if (!payload) return false
  if (await isAdminSessionRevoked(payload.jti)) return false
  if (await dbIsAdminSessionRevoked(payload.jti)) return false
  return true
}

export async function revokeAdminSessionToken(token: string | undefined | null): Promise<void> {
  const payload = await readAdminSessionPayload(token)
  if (!payload) return
  await Promise.all([
    revokeAdminSessionJti(payload.jti),
    persistRevokedAdminJti(payload.jti),
  ])
}

export function getAdminCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SEC) {
  return {
    path: '/',
    maxAge,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function createAdminPendingTwoFactorToken(): Promise<string> {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const sv = await getAdminSessionVersion()
  return new SignJWT({
    role: ADMIN_2FA_PENDING_ROLE,
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE_2FA)
    .setIssuedAt(now)
    .setExpirationTime(now + ADMIN_2FA_PENDING_MAX_AGE_SEC)
    .sign(new TextEncoder().encode(secret))
}

export async function verifyAdminPendingTwoFactorToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return false
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_2FA,
    })
    if (payload.sub !== 'admin') return false
    if (payload.role !== ADMIN_2FA_PENDING_ROLE) return false
    const expected = await getAdminSessionVersion()
    return payload[ADMIN_SESSION_VERSION_CLAIM] === expected
  } catch {
    return false
  }
}
