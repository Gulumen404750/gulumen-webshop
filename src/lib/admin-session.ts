/**
 * Aláírt admin session cookie (JWT/HMAC): sub, iat, exp, sv (session version).
 * Az sv claim JWT_SECRET + ADMIN_API_KEY hash-e: kulcsváltáskor a régi sütik azonnal érvénytelenek.
 */

import { SignJWT, jwtVerify } from 'jose'
import {
  ADMIN_COOKIE_NAME,
  JWT_ISSUER,
  JWT_AUDIENCE,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
} from '@/lib/admin-session-constants'
import { getAdminSessionVersion } from '@/lib/admin-session-version'

export {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
}

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
}

export function isAdminSessionConfigured(): boolean {
  return getSecret() !== null
}

export async function createAdminSessionToken(): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const sv = await getAdminSessionVersion()
  return new SignJWT({ role: 'admin', [ADMIN_SESSION_VERSION_CLAIM]: sv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ADMIN_SESSION_MAX_AGE_SEC)
    .sign(secret)
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || token === '1') return false
  const secret = getSecret()
  if (!secret) return false
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    if (payload.sub !== 'admin') return false
    const expected = await getAdminSessionVersion()
    return payload[ADMIN_SESSION_VERSION_CLAIM] === expected
  } catch {
    return false
  }
}

export function getAdminCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SEC) {
  return {
    path: '/',
    maxAge,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}
