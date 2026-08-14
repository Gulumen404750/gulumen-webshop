/**
 * Admin JWT aláírás / claim-ellenőrzés (Edge + Node).
 * Revoke listát a hívó ellenőrzi.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import {
  ADMIN_SESSION_ACTIVITY_CLAIM,
  ADMIN_SESSION_IDLE_SEC,
  ADMIN_SESSION_JTI_CLAIM,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_TFA_CLAIM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '@/lib/admin-session-constants'
import { getAdminSessionVersion } from '@/lib/admin-session-version'

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
}

export function readAdminSessionClaims(
  payload: JWTPayload,
  now = Math.floor(Date.now() / 1000)
): AdminSessionClaims | null {
  if (payload.sub !== 'admin') return null
  if (payload[ADMIN_TFA_CLAIM] !== true) return null
  const jti = payload[ADMIN_SESSION_JTI_CLAIM]
  const act = payload[ADMIN_SESSION_ACTIVITY_CLAIM]
  const sv = payload[ADMIN_SESSION_VERSION_CLAIM]
  if (typeof jti !== 'string' || jti.length < 16) return null
  if (typeof act !== 'number' || !Number.isFinite(act)) return null
  if (typeof sv !== 'string' || !sv) return null
  if (now - act > ADMIN_SESSION_IDLE_SEC) return null
  return { jti, act, sv }
}

export async function signAdminSessionToken(opts?: {
  jti?: string
  act?: number
}): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error('JWT_SECRET / NEXTAUTH_SECRET not configured')
  const now = Math.floor(Date.now() / 1000)
  const sv = await getAdminSessionVersion()
  const jti = opts?.jti || newAdminSessionJti()
  const act = opts?.act ?? now
  return new SignJWT({
    role: 'admin',
    [ADMIN_SESSION_VERSION_CLAIM]: sv,
    [ADMIN_TFA_CLAIM]: true,
    [ADMIN_SESSION_JTI_CLAIM]: jti,
    [ADMIN_SESSION_ACTIVITY_CLAIM]: act,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
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
    const expected = await getAdminSessionVersion()
    if (claims.sv !== expected) return null
    return { ...payload, ...claims }
  } catch {
    return null
  }
}

export function shouldRefreshAdminSession(act: number, now = Math.floor(Date.now() / 1000)): boolean {
  return now - act >= 60
}

export { getSecret as getAdminJwtSecret }
