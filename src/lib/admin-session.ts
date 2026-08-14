/**
 * Aláírt admin session cookie (JWT/HMAC): sub, iat, exp, sv, tfa, ep.
 * sv: JWT_SECRET + ADMIN_API_KEY hash (kulcsváltáskor azonnal érvénytelen).
 * ep: Admin.sessionEpoch – jelszócsere / reset után a régi sütik érvénytelenek.
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
  ADMIN_SESSION_EPOCH_CLAIM,
  ADMIN_TFA_CLAIM,
  ADMIN_2FA_PENDING_ROLE,
} from '@/lib/admin-session-constants'
import { getAdminSessionVersion } from '@/lib/admin-session-version'
import { getAdminSessionEpoch } from '@/lib/admin-session-epoch'

export {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_SESSION_EPOCH_CLAIM,
}

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
}

export function isAdminSessionConfigured(): boolean {
  return getSecret() !== null
}

async function sessionVersionClaims(): Promise<{ sv: string; ep: number }> {
  const ep = await getAdminSessionEpoch()
  const sv = await getAdminSessionVersion()
  return { sv, ep }
}

function epochFromPayload(payload: { [key: string]: unknown }): number {
  const raw = payload[ADMIN_SESSION_EPOCH_CLAIM]
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0
}

export async function createAdminSessionToken(): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const { sv, ep } = await sessionVersionClaims()
  return new SignJWT({
    role: 'admin',
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
    [ADMIN_SESSION_EPOCH_CLAIM]: ep,
    [ADMIN_TFA_CLAIM]: true,
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
    if (payload[ADMIN_TFA_CLAIM] !== true) return false
    const { sv, ep } = await sessionVersionClaims()
    if (payload[ADMIN_SESSION_VERSION_CLAIM] !== sv) return false
    return epochFromPayload(payload as { [key: string]: unknown }) === ep
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
  const { sv, ep } = await sessionVersionClaims()
  return new SignJWT({
    role: ADMIN_2FA_PENDING_ROLE,
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
    [ADMIN_SESSION_EPOCH_CLAIM]: ep,
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
    const { sv, ep } = await sessionVersionClaims()
    if (payload[ADMIN_SESSION_VERSION_CLAIM] !== sv) return false
    return epochFromPayload(payload as { [key: string]: unknown }) === ep
  } catch {
    return false
  }
}
