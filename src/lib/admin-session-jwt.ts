/**
 * Admin JWT aláírás / claim-ellenőrzés (Edge + Node).
 * Idle (act) + jti + RBAC actor (sub/role/un) + ak (ADMIN_API_KEY binding). Revoke listát a hívó ellenőrzi.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import {
  ADMIN_ACTOR_ROLE_CLAIM,
  ADMIN_SESSION_ACTIVITY_CLAIM,
  ADMIN_SESSION_API_KEY_CLAIM,
  ADMIN_SESSION_IDLE_SEC,
  ADMIN_SESSION_JTI_CLAIM,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_TFA_CLAIM,
  ADMIN_USERNAME_CLAIM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '@/lib/admin-session-constants'
import { getAdminApiKeyClaim, getAdminSessionVersion } from '@/lib/admin-session-version'
import {
  type AdminActor,
  BOOTSTRAP_ADMIN_ACTOR,
  isAdminRole,
} from '@/lib/admin-rbac'

export function newAdminSessionJti(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
}

export function isAdminSessionConfigured(): boolean {
  return getSecret() !== null
}

export type AdminSessionClaims = {
  jti: string
  act: number
  sv: string
  ak: string
  actor: AdminActor
}

export function actorFromSessionPayload(payload: JWTPayload): AdminActor | null {
  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  if (!sub) return null
  const role = payload.role
  if (role === 'admin' && sub === 'admin') {
    return BOOTSTRAP_ADMIN_ACTOR
  }
  if (!isAdminRole(role)) return null
  const usernameClaim = payload[ADMIN_USERNAME_CLAIM]
  const username =
    typeof usernameClaim === 'string' && usernameClaim.trim()
      ? usernameClaim.trim()
      : sub === 'admin'
        ? 'admin'
        : sub
  return {
    id: sub,
    username,
    role,
    bootstrap: sub === 'admin',
  }
}

export function readAdminSessionClaims(
  payload: JWTPayload,
  now = Math.floor(Date.now() / 1000)
): AdminSessionClaims | null {
  if (payload[ADMIN_TFA_CLAIM] !== true) return null
  const actor = actorFromSessionPayload(payload)
  if (!actor) return null
  const jti = payload[ADMIN_SESSION_JTI_CLAIM] ?? payload.jti
  const act = payload[ADMIN_SESSION_ACTIVITY_CLAIM]
  const sv = payload[ADMIN_SESSION_VERSION_CLAIM]
  const ak = payload[ADMIN_SESSION_API_KEY_CLAIM]
  if (typeof jti !== 'string' || jti.length < 16) return null
  if (typeof act !== 'number' || !Number.isFinite(act)) return null
  if (typeof sv !== 'string' || !sv) return null
  if (typeof ak !== 'string' || !ak) return null
  if (now - act > ADMIN_SESSION_IDLE_SEC) return null
  return { jti, act, sv, ak, actor }
}

export async function signAdminSessionToken(opts?: {
  actor?: AdminActor
  jti?: string
  act?: number
}): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const actor = opts?.actor ?? BOOTSTRAP_ADMIN_ACTOR
  const now = Math.floor(Date.now() / 1000)
  const [sv, ak] = await Promise.all([getAdminSessionVersion(), getAdminApiKeyClaim()])
  const jti = opts?.jti || newAdminSessionJti()
  const act = opts?.act ?? now
  return new SignJWT({
    role: actor.role,
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
    [ADMIN_SESSION_API_KEY_CLAIM]: ak,
    [ADMIN_TFA_CLAIM]: true,
    [ADMIN_SESSION_JTI_CLAIM]: jti,
    [ADMIN_SESSION_ACTIVITY_CLAIM]: act,
    [ADMIN_USERNAME_CLAIM]: actor.username,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setJti(jti)
    .setExpirationTime(now + ADMIN_SESSION_MAX_AGE_SEC)
    .sign(secret)
}

export async function readAdminSessionPayload(
  token: string | undefined | null
): Promise<(JWTPayload & AdminSessionClaims) | null> {
  if (!token || token === '1') return null
  const secret = getSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    const claims = readAdminSessionClaims(payload)
    if (!claims) return null
    const [expectedSv, expectedAk] = await Promise.all([
      getAdminSessionVersion(),
      getAdminApiKeyClaim(),
    ])
    if (claims.sv !== expectedSv) return null
    if (claims.ak !== expectedAk) return null
    return { ...payload, ...claims }
  } catch {
    return null
  }
}

export function shouldRefreshAdminSession(act: number, now = Math.floor(Date.now() / 1000)): boolean {
  return now - act >= 60
}

export function actorFromPendingPayload(payload: JWTPayload): AdminActor | null {
  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  if (!sub) return null
  if (payload.role !== 'admin-2fa-pending') return null
  const claimed = payload[ADMIN_ACTOR_ROLE_CLAIM]
  const role = isAdminRole(claimed) ? claimed : sub === 'admin' ? 'owner' : null
  if (!role) return null
  const usernameClaim = payload[ADMIN_USERNAME_CLAIM]
  const username =
    typeof usernameClaim === 'string' && usernameClaim.trim()
      ? usernameClaim.trim()
      : sub === 'admin'
        ? 'admin'
        : sub
  return {
    id: sub,
    username,
    role,
    bootstrap: sub === 'admin',
  }
}

export { getSecret as getAdminJwtSecret }
