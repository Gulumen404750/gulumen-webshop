/**
 * Edge-safe admin session verify + sliding idle refresh (middleware).
 * Elfogad név szerinti operátor JWT-t és a bootstrap owner sütit is.
 * A Node `getAdminActor` dönti el, hogy a bootstrap session még érvényes-e.
 * sv + ak: JWT_SECRET aláírás mellett az ADMIN_API_KEY csere is azonnal kiléptet.
 * ep (session epoch): ha van Redis érték (`admin:session-epoch`), az `ep` claimnek egyeznie
 * kell – Redis nélkül itt fail-open (nincs Prisma az Edge-en), a Node réteg (admin-session.ts)
 * a DB-ből mindig véglegesen ellenőriz jelszócsere / reset után.
 */

import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_SESSION_EPOCH_REDIS_KEY,
} from '@/lib/admin-session-constants'
import {
  readAdminSessionPayload,
  shouldRefreshAdminSession,
  signAdminSessionToken,
} from '@/lib/admin-session-jwt'
import { isAdminSessionRevoked } from '@/lib/admin-session-revoke'
import { getRedis } from '@/lib/redis'

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

function parseEpoch(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 0) return 0
  return n
}

/** `null`: nincs Redis / nincs kulcs / hiba → epochot itt nem kényszerítjük. */
async function getEdgeSessionEpoch(): Promise<number | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const cached = await redis.get<string | number>(ADMIN_SESSION_EPOCH_REDIS_KEY)
    if (cached === null || cached === undefined) return null
    return parseEpoch(cached)
  } catch {
    return null
  }
}

async function isEpochValid(payloadEpoch: number): Promise<boolean> {
  const redisEpoch = await getEdgeSessionEpoch()
  if (redisEpoch === null) return true
  return parseEpoch(payloadEpoch) === redisEpoch
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  const payload = await readAdminSessionPayload(token)
  if (!payload) return false
  if (await isAdminSessionRevoked(payload.jti)) return false
  if (!(await isEpochValid(payload.ep))) return false
  return true
}

export async function refreshAdminSessionCookieIfNeeded(
  token: string | undefined | null
): Promise<string | null> {
  const payload = await readAdminSessionPayload(token)
  if (!payload) return null
  if (await isAdminSessionRevoked(payload.jti)) return null
  if (!(await isEpochValid(payload.ep))) return null
  if (!shouldRefreshAdminSession(payload.act)) return null
  return signAdminSessionToken({
    actor: payload.actor,
    jti: payload.jti,
    ep: payload.ep,
  })
}
