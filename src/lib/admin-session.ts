/**
 * Aláírt admin session cookie (JWT/HMAC): sub, iat, exp, sv, jti, act, tfa, role, un.
 * Logout: jti denylist. Inaktivitás: act (30 perc).
 * Bootstrap (nincs operátor): sub=admin, role=owner. Név szerinti: sub=operatorId.
 */

import { SignJWT, jwtVerify } from 'jose'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  JWT_ISSUER,
  JWT_AUDIENCE_2FA,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_2FA_PENDING_ROLE,
  ADMIN_USERNAME_CLAIM,
  ADMIN_ACTOR_ROLE_CLAIM,
} from '@/lib/admin-session-constants'
import { getAdminSessionVersion } from '@/lib/admin-session-version'
import {
  isAdminSessionConfigured,
  readAdminSessionPayload,
  signAdminSessionToken,
  actorFromPendingPayload,
  getAdminJwtSecret,
} from '@/lib/admin-session-jwt'
import { isAdminSessionRevoked, revokeAdminSessionJti } from '@/lib/admin-session-revoke'
import { dbIsAdminSessionRevoked, persistRevokedAdminJti } from '@/lib/admin-session-revoke-db'
import { type AdminActor, BOOTSTRAP_ADMIN_ACTOR } from '@/lib/admin-rbac'

export {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
}

export { isAdminSessionConfigured }

export async function createAdminSessionToken(
  actor: AdminActor = BOOTSTRAP_ADMIN_ACTOR
): Promise<string> {
  return signAdminSessionToken({ actor })
}

export async function parseAdminSessionToken(
  token: string | undefined | null
): Promise<AdminActor | null> {
  const payload = await readAdminSessionPayload(token)
  if (!payload) return null
  if (await isAdminSessionRevoked(payload.jti)) return null
  if (await dbIsAdminSessionRevoked(payload.jti)) return null
  return payload.actor
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  return (await parseAdminSessionToken(token)) !== null
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

export async function createAdminPendingTwoFactorToken(
  actor: AdminActor = BOOTSTRAP_ADMIN_ACTOR
): Promise<string> {
  const secret = getAdminJwtSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const sv = await getAdminSessionVersion()
  return new SignJWT({
    role: ADMIN_2FA_PENDING_ROLE,
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
    [ADMIN_USERNAME_CLAIM]: actor.username,
    [ADMIN_ACTOR_ROLE_CLAIM]: actor.role,
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
  const secret = getAdminJwtSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_2FA,
    })
    const expected = await getAdminSessionVersion()
    if (payload[ADMIN_SESSION_VERSION_CLAIM] !== expected) return null
    return actorFromPendingPayload(payload)
  } catch {
    return null
  }
}

export async function verifyAdminPendingTwoFactorToken(
  token: string | undefined | null
): Promise<boolean> {
  return (await parseAdminPendingTwoFactorToken(token)) !== null
}
