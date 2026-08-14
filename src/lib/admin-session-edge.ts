/**
 * Edge-safe admin session verify + sliding idle refresh (middleware).
 */

import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SEC,
} from '@/lib/admin-session-constants'
import {
  readAdminSessionPayload,
  shouldRefreshAdminSession,
  signAdminSessionToken,
} from '@/lib/admin-session-jwt'
import { isAdminSessionRevoked } from '@/lib/admin-session-revoke'

export { ADMIN_COOKIE_NAME, signAdminSessionToken }

export function getAdminCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SEC) {
  return {
    path: '/',
    maxAge,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  const payload = await readAdminSessionPayload(token)
  if (!payload) return false
  if (await isAdminSessionRevoked(payload.jti)) return false
  return true
}

export async function refreshAdminSessionCookieIfNeeded(
  token: string | undefined | null
): Promise<string | null> {
  const payload = await readAdminSessionPayload(token)
  if (!payload) return null
  if (await isAdminSessionRevoked(payload.jti)) return null
  if (!shouldRefreshAdminSession(payload.act)) return null
  return signAdminSessionToken({ jti: payload.jti })
}
