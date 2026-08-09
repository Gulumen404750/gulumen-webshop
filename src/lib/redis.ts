/**
 * Upstash Redis kliens. Ha UPSTASH_REDIS_REST_URL / TOKEN nincs beállítva,
 * null → rate-limit / idempotency in-memory fallback (tiszta, hiba nélkül).
 */

import { Redis } from '@upstash/redis'

let redis: Redis | null | undefined

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  )
}

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  if (!isRedisConfigured()) {
    redis = null
    return null
  }
  try {
    redis = Redis.fromEnv()
  } catch (err) {
    console.warn('[redis] init failed, memory fallback for rate-limit/idempotency:', err)
    redis = null
  }
  return redis
}

/** Teszt / hot-reload: kliens cache ürítése. */
export function resetRedisClientForTests(): void {
  redis = undefined
}
