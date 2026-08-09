/**
 * Upstash Redis kliens. Ha UPSTASH_REDIS_REST_URL / TOKEN nincs beállítva,
 * null-t ad vissza → a rate-limit / idempotency in-memory fallbackre vált.
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
  redis = Redis.fromEnv()
  return redis
}
