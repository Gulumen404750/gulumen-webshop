/**
 * Login brute-force védelem: max 10 sikertelen kísérlet / 10 perc / IP.
 * Upstash Redis (multi-instance); fallback in-memory Map.
 */

import { logger } from '@/lib/logger'
import { getRedis, isRedisConfigured } from '@/lib/redis'

const WINDOW_MS = 10 * 60 * 1000
const MAX_FAILED_PER_WINDOW = 10
const REDIS_PREFIX = 'login:fail:'

type Entry = { failedCount: number; resetAt: number }

const store = new Map<string, Entry>()

function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp
  return 'unknown'
}

function memoryCheck(id: string): { ok: true } | { ok: false; status: 429 } {
  const now = Date.now()
  let entry = store.get(id)
  if (!entry || now >= entry.resetAt) {
    entry = { failedCount: 0, resetAt: now + WINDOW_MS }
    store.set(id, entry)
  }
  if (entry.failedCount >= MAX_FAILED_PER_WINDOW) {
    logger.warn({ ip: id, failedCount: entry.failedCount }, 'Login rate limit exceeded')
    return { ok: false, status: 429 }
  }
  return { ok: true }
}

/**
 * Check if the client is over the limit (before attempting login).
 */
export async function loginRateLimitCheck(
  request: Request
): Promise<{ ok: true } | { ok: false; status: 429 }> {
  const id = getClientId(request)

  if (isRedisConfigured()) {
    const redis = getRedis()
    if (redis) {
      const key = REDIS_PREFIX + id
      const count = await redis.get<number>(key)
      if (typeof count === 'number' && count >= MAX_FAILED_PER_WINDOW) {
        logger.warn({ ip: id, failedCount: count }, 'Login rate limit exceeded')
        return { ok: false, status: 429 }
      }
      return { ok: true }
    }
  }

  return memoryCheck(id)
}

/** Call on failed login (wrong password / user not found). */
export async function loginRateLimitRecordFailure(request: Request): Promise<void> {
  const id = getClientId(request)

  if (isRedisConfigured()) {
    const redis = getRedis()
    if (redis) {
      const key = REDIS_PREFIX + id
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.pexpire(key, WINDOW_MS)
      }
      return
    }
  }

  const now = Date.now()
  let entry = store.get(id)
  if (!entry || now >= entry.resetAt) {
    entry = { failedCount: 0, resetAt: now + WINDOW_MS }
    store.set(id, entry)
  }
  entry.failedCount += 1
  store.set(id, entry)
}

/** Call on successful login to reset failed counter for this IP. */
export async function loginRateLimitRecordSuccess(request: Request): Promise<void> {
  const id = getClientId(request)

  if (isRedisConfigured()) {
    const redis = getRedis()
    if (redis) {
      await redis.del(REDIS_PREFIX + id)
      return
    }
  }

  store.delete(id)
}
