/**
 * Aláírt admin session cookie (JWT/HMAC): sub = operátor id, role = RBAC szerep.
 * Az sv claim JWT_SECRET + ADMIN_API_KEY hash-e: kulcsváltáskor a régi sütik azonnal érvénytelenek.
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
  ADMIN_2FA_PENDING_ROLE,
  ADMIN_USERNAME_CLAIM,
  ADMIN_ACTOR_ROLE_CLAIM,
} from '@/lib/admin-session-constants'
import { getAdminSessionVersion } from '@/lib/admin-session-version'
import { type AdminActor, isAdminRole } from '@/lib/admin-rbac'

export {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
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

function actorFromPayload(payload: {
  sub?: string
  role?: unknown
  [ADMIN_USERNAME_CLAIM]?: unknown
}): AdminActor | null {
  const id = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  const username =
    typeof payload[ADMIN_USERNAME_CLAIM] === 'string'
      ? payload[ADMIN_USERNAME_CLAIM].trim().toLowerCase()
      : ''
  if (!id || !username || !isAdminRole(payload.role)) return null
  return { id, username, role: payload.role }
}

export async function createAdminSessionToken(actor: AdminActor): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const sv = await getAdminSessionVersion()
  return new SignJWT({
    role: actor.role,
    [ADMIN_USERNAME_CLAIM]: actor.username,
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ADMIN_SESSION_MAX_AGE_SEC)
    .sign(secret)
}

export async function parseAdminSessionToken(
  token: string | undefined | null
): Promise<AdminActor | null> {
  if (!token || token === '1') return null
  const secret = getSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    const expected = await getAdminSessionVersion()
    if (payload[ADMIN_SESSION_VERSION_CLAIM] !== expected) return null
    return actorFromPayload(payload)
  } catch {
    return null
  }
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  return (await parseAdminSessionToken(token)) !== null
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

export async function createAdminPendingTwoFactorToken(actor: AdminActor): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const sv = await getAdminSessionVersion()
  return new SignJWT({
    role: ADMIN_2FA_PENDING_ROLE,
    [ADMIN_USERNAME_CLAIM]: actor.username,
    [ADMIN_ACTOR_ROLE_CLAIM]: actor.role,
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE_2FA)
    .setIssuedAt(now)
    .setExpirationTime(now + ADMIN_2FA_PENDING_MAX_AGE_SEC)
    .sign(secret)
}

export async function parseAdminPendingTwoFactorToken(
  token: string | undefined | null
): Promise<AdminActor | null> {
  if (!token) return null
  const secret = getSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_2FA,
    })
    if (payload.role !== ADMIN_2FA_PENDING_ROLE) return null
    const expected = await getAdminSessionVersion()
    if (payload[ADMIN_SESSION_VERSION_CLAIM] !== expected) return null
    const id = typeof payload.sub === 'string' ? payload.sub.trim() : ''
    const username =
      typeof payload[ADMIN_USERNAME_CLAIM] === 'string'
        ? payload[ADMIN_USERNAME_CLAIM].trim().toLowerCase()
        : ''
    const role = payload[ADMIN_ACTOR_ROLE_CLAIM]
    if (!id || !username || !isAdminRole(role)) return null
    return { id, username, role }
  } catch {
    return null
  }
}

export async function verifyAdminPendingTwoFactorToken(
  token: string | undefined | null
): Promise<boolean> {
  return (await parseAdminPendingTwoFactorToken(token)) !== null
}
