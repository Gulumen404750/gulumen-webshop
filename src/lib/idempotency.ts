/**
 * Checkout idempotencia – Upstash Redis (multi-instance); fallback in-memory Map.
 */

import { getRedis, isRedisConfigured } from '@/lib/redis'

const TTL_MS = 24 * 60 * 60 * 1000
const TTL_SEC = 24 * 60 * 60
const REDIS_PREFIX = 'idem:'

type CachedResponse = {
  body: unknown
  status: number
  headers: Record<string, string>
  createdAt: number
}

const store = new Map<string, CachedResponse>()

function pruneExpired(): void {
  const now = Date.now()
  Array.from(store.entries()).forEach(([key, entry]) => {
    if (now - entry.createdAt > TTL_MS) store.delete(key)
  })
}

export async function getIdempotentResponse(
  key: string
): Promise<{ body: unknown; status: number; headers: Record<string, string> } | null> {
  if (isRedisConfigured()) {
    try {
      const redis = getRedis()
      if (redis) {
        const raw = await redis.get<CachedResponse>(REDIS_PREFIX + key)
        if (!raw) return null
        return { body: raw.body, status: raw.status, headers: raw.headers ?? {} }
      }
    } catch (err) {
      console.warn('[idempotency] Redis get failed, memory fallback:', err)
    }
  }

  pruneExpired()
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(key)
    return null
  }
  return { body: entry.body, status: entry.status, headers: entry.headers }
}

export async function setIdempotentResponse(
  key: string,
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): Promise<void> {
  const entry: CachedResponse = { body, status, headers, createdAt: Date.now() }

  if (isRedisConfigured()) {
    try {
      const redis = getRedis()
      if (redis) {
        await redis.set(REDIS_PREFIX + key, entry, { ex: TTL_SEC })
        return
      }
    } catch (err) {
      console.warn('[idempotency] Redis set failed, memory fallback:', err)
    }
  }

  pruneExpired()
  store.set(key, entry)
}

export function getIdempotencyKey(request: Request): string | null {
  const key = request.headers.get('Idempotency-Key')?.trim()
  if (!key || key.length > 128) return null
  return key
}
