/**
 * Edge-safe admin session verify (middleware).
 */

import { jwtVerify } from 'jose'
import {
  ADMIN_COOKIE_NAME,
  JWT_ISSUER,
  JWT_AUDIENCE,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_USERNAME_CLAIM,
} from '@/lib/admin-session-constants'
import { getAdminSessionVersion } from '@/lib/admin-session-version'
import { isAdminRole } from '@/lib/admin-rbac'

export { ADMIN_COOKIE_NAME }

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
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
    const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
    const username =
      typeof payload[ADMIN_USERNAME_CLAIM] === 'string' ? payload[ADMIN_USERNAME_CLAIM].trim() : ''
    if (!sub || !username || !isAdminRole(payload.role)) return false
    const expected = await getAdminSessionVersion()
    return payload[ADMIN_SESSION_VERSION_CLAIM] === expected
  } catch {
    return false
  }
}
