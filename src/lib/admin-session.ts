/**
 * Aláírt admin session cookie (JWT/HMAC): sub, iat, exp.
 * A korábbi admin_authorized=1 cookie könnyen manipulálható volt.
 */

import { SignJWT, jwtVerify } from 'jose'

export const ADMIN_COOKIE_NAME = 'admin_authorized'
const JWT_ISSUER = 'gulumen-admin'
const JWT_AUDIENCE = 'gulumen-admin'
const MAX_AGE_SEC = 60 * 60 * 24 // 24 óra

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
}

export function isAdminSessionConfigured(): boolean {
  return getSecret() !== null
}

/** Aláírt session token (sub=admin, iat, exp). */
export async function createAdminSessionToken(): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + MAX_AGE_SEC)
    .sign(secret)
}

/** True ha a cookie érték érvényes, aláírt admin JWT. */
export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || token === '1') return false
  const secret = getSecret()
  if (!secret) return false
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    return payload.sub === 'admin'
  } catch {
    return false
  }
}

export function getAdminCookieOptions(maxAge = MAX_AGE_SEC) {
  return {
    path: '/',
    maxAge,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

export { MAX_AGE_SEC as ADMIN_SESSION_MAX_AGE_SEC }
