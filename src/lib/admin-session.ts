/**
 * Aláírt admin session cookie (JWT/HMAC): sub, iat, exp, sv, ak, ep, jti, act, tfa, role, un.
 * Aláírás: JWT_SECRET. Binding: sv (secret+key) és ak (csak ADMIN_API_KEY) –
 * kulcsváltáskor a régi sütik azonnal érvénytelenek, a JWT_SECRET-et nem kell cserélni.
 * ep: Admin.sessionEpoch – jelszócsere / reset után is azonnal érvénytelen a régi süti.
 * Logout: jti denylist. Inaktivitás: act (30 perc).
 * Bootstrap (nincs operátor): sub=admin, role=owner. Név szerinti: sub=operatorId.
 * Session izoláció: owner → admin_authorized; operátor → operator_authorized.
 */

import { SignJWT, jwtVerify } from 'jose'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  OPERATOR_COOKIE_NAME,
  JWT_ISSUER,
  JWT_AUDIENCE_2FA,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_SESSION_API_KEY_CLAIM,
  ADMIN_SESSION_EPOCH_CLAIM,
  ADMIN_2FA_PENDING_ROLE,
  ADMIN_USERNAME_CLAIM,
  ADMIN_ACTOR_ROLE_CLAIM,
  ADMIN_LOGIN_SCOPE_CLAIM,
  type AdminLoginScope,
} from '@/lib/admin-session-constants'
import { getAdminApiKeyClaim, getAdminSessionVersion } from '@/lib/admin-session-version'
import { getAdminSessionEpoch } from '@/lib/admin-session-epoch'
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
  OPERATOR_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_SESSION_API_KEY_CLAIM,
  ADMIN_SESSION_EPOCH_CLAIM,
}

export { isAdminSessionConfigured }

export async function createAdminSessionToken(
  actor: AdminActor = BOOTSTRAP_ADMIN_ACTOR
): Promise<string> {
  const ep = await getAdminSessionEpoch()
  return signAdminSessionToken({ actor, ep })
}

export async function parseAdminSessionToken(
  token: string | undefined | null
): Promise<AdminActor | null> {
  const payload = await readAdminSessionPayload(token)
  if (!payload) return null
  if (await isAdminSessionRevoked(payload.jti)) return null
  if (await dbIsAdminSessionRevoked(payload.jti)) return null
  const currentEpoch = await getAdminSessionEpoch()
  if (payload.ep !== currentEpoch) return null
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

/** Owner / bootstrap session → admin_authorized; minden DB-operátor → operator_authorized. */
export function sessionCookieNameForActor(
  actor: AdminActor
): typeof ADMIN_COOKIE_NAME | typeof OPERATOR_COOKIE_NAME {
  // Csak a gyári főadmin (ADMIN_API_KEY bootstrap) használja az owner sütit.
  // DB `role=owner` operátorok is az operator_authorized sütibe tartoznak.
  if (actor.bootstrap || actor.id === 'admin') {
    return ADMIN_COOKIE_NAME
  }
  return OPERATOR_COOKIE_NAME
}

export function sessionCookieNameForScope(
  scope: AdminLoginScope
): typeof ADMIN_COOKIE_NAME | typeof OPERATOR_COOKIE_NAME {
  return scope === 'owner' ? ADMIN_COOKIE_NAME : OPERATOR_COOKIE_NAME
}

export async function createAdminPendingTwoFactorToken(
  actor: AdminActor = BOOTSTRAP_ADMIN_ACTOR,
  scope: AdminLoginScope = actor.bootstrap || actor.role === 'owner' ? 'owner' : 'operator'
): Promise<string> {
  const secret = getAdminJwtSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const [sv, ak, ep] = await Promise.all([
    getAdminSessionVersion(),
    getAdminApiKeyClaim(),
    getAdminSessionEpoch(),
  ])
  return new SignJWT({
    role: ADMIN_2FA_PENDING_ROLE,
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
    [ADMIN_SESSION_API_KEY_CLAIM]: ak,
    [ADMIN_SESSION_EPOCH_CLAIM]: ep,
    [ADMIN_USERNAME_CLAIM]: actor.username,
    [ADMIN_ACTOR_ROLE_CLAIM]: actor.role,
    [ADMIN_LOGIN_SCOPE_CLAIM]: scope,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE_2FA)
    .setIssuedAt(now)
    .setExpirationTime(now + ADMIN_2FA_PENDING_MAX_AGE_SEC)
    .sign(secret)
}

export type PendingTwoFactorSession = {
  actor: AdminActor
  scope: AdminLoginScope
}

export async function parseAdminPendingTwoFactorSession(
  token: string | undefined | null
): Promise<PendingTwoFactorSession | null> {
  if (!token) return null
  const secret = getAdminJwtSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_2FA,
    })
    const [expectedSv, expectedAk, expectedEp] = await Promise.all([
      getAdminSessionVersion(),
      getAdminApiKeyClaim(),
      getAdminSessionEpoch(),
    ])
    if (payload[ADMIN_SESSION_VERSION_CLAIM] !== expectedSv) return null
    if (payload[ADMIN_SESSION_API_KEY_CLAIM] !== expectedAk) return null
    if (payload[ADMIN_SESSION_EPOCH_CLAIM] !== expectedEp) return null
    const actor = actorFromPendingPayload(payload)
    if (!actor) return null
    const rawScope = payload[ADMIN_LOGIN_SCOPE_CLAIM]
    const scope: AdminLoginScope =
      rawScope === 'operator'
        ? 'operator'
        : rawScope === 'owner'
          ? 'owner'
          : actor.bootstrap || actor.role === 'owner'
            ? 'owner'
            : 'operator'
    return { actor, scope }
  } catch {
    return null
  }
}

export async function parseAdminPendingTwoFactorToken(
  token: string | undefined | null
): Promise<AdminActor | null> {
  const session = await parseAdminPendingTwoFactorSession(token)
  return session?.actor ?? null
}

export async function verifyAdminPendingTwoFactorToken(
  token: string | undefined | null
): Promise<boolean> {
  return (await parseAdminPendingTwoFactorToken(token)) !== null
}
