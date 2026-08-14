/**
 * Aláírt admin session cookie (JWT/HMAC): sub, iat, exp, sv, ak.
 * Aláírás: JWT_SECRET. Binding: sv (secret+key) és ak (csak ADMIN_API_KEY) –
 * kulcsváltáskor a régi 24 órás sütik azonnal érvénytelenek.
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
  ADMIN_SESSION_API_KEY_CLAIM,
  ADMIN_2FA_PENDING_ROLE,
} from '@/lib/admin-session-constants'
import { getAdminApiKeyClaim, getAdminSessionVersion } from '@/lib/admin-session-version'

export {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_SESSION_API_KEY_CLAIM,
}

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
}

export function isAdminSessionConfigured(): boolean {
  return getSecret() !== null
}

async function sessionBindingClaims(): Promise<{ sv: string; ak: string }> {
  const [sv, ak] = await Promise.all([getAdminSessionVersion(), getAdminApiKeyClaim()])
  return { sv, ak }
}

function claimsMatchExpected(
  payload: { [key: string]: unknown },
  expected: { sv: string; ak: string }
): boolean {
  return (
    payload[ADMIN_SESSION_VERSION_CLAIM] === expected.sv &&
    payload[ADMIN_SESSION_API_KEY_CLAIM] === expected.ak
  )
}

export async function createAdminSessionToken(): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const { sv, ak } = await sessionBindingClaims()
  return new SignJWT({
    role: 'admin',
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
    [ADMIN_SESSION_API_KEY_CLAIM]: ak,
  })
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
    const expected = await sessionBindingClaims()
    return claimsMatchExpected(payload as { [key: string]: unknown }, expected)
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

export async function createAdminPendingTwoFactorToken(): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const { sv, ak } = await sessionBindingClaims()
  return new SignJWT({
    role: ADMIN_2FA_PENDING_ROLE,
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
    [ADMIN_SESSION_API_KEY_CLAIM]: ak,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE_2FA)
    .setIssuedAt(now)
    .setExpirationTime(now + ADMIN_2FA_PENDING_MAX_AGE_SEC)
    .sign(secret)
}

export async function verifyAdminPendingTwoFactorToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false
  const secret = getSecret()
  if (!secret) return false
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_2FA,
    })
    if (payload.sub !== 'admin') return false
    if (payload.role !== ADMIN_2FA_PENDING_ROLE) return false
    const expected = await sessionBindingClaims()
    return claimsMatchExpected(payload as { [key: string]: unknown }, expected)
  } catch {
    return false
  }
}
