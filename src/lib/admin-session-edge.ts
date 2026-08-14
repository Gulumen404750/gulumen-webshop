/**
 * Edge-safe admin session verify (middleware).
 * Session epoch: ha van Redis érték (`admin:session-epoch`), az `ep` claimnek egyeznie kell.
 * Redis nélkül csak az sv (API kulcs / JWT secret) számít; a Node (API + dashboard) DB-ből invalidál.
 */

import { jwtVerify } from 'jose'
import {
  ADMIN_COOKIE_NAME,
  JWT_ISSUER,
  JWT_AUDIENCE,
  ADMIN_SESSION_VERSION_CLAIM,
  ADMIN_SESSION_EPOCH_CLAIM,
  ADMIN_SESSION_EPOCH_REDIS_KEY,
} from '@/lib/admin-session-constants'
import { getAdminSessionVersion } from '@/lib/admin-session-version'
import { getRedis } from '@/lib/redis'

export { ADMIN_COOKIE_NAME }

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
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
    const expected = await getAdminSessionVersion()
    if (payload[ADMIN_SESSION_VERSION_CLAIM] !== expected) return false
    const redisEpoch = await getEdgeSessionEpoch()
    if (redisEpoch === null) return true
    return parseEpoch(payload[ADMIN_SESSION_EPOCH_CLAIM]) === redisEpoch
  } catch {
    return false
  }
}
