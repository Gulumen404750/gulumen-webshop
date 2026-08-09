/**
 * Checkout idempotencia: ugyanazzal az Idempotency-Key headerrel
 * érkező kérésnél a korábbi választ adjuk vissza.
 * Upstash Redis (multi-instance); fallback in-memory Map.
 */

import { getRedis, isRedisConfigured } from '@/lib/redis'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 óra
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

/** Visszaadja a kulcshoz tartozó cache-elt választ, vagy null. */
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

/** Eltárolja a választ az idempotency key alatt. */
export async function setIdempotentResponse(
  key: string,
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): Promise<void> {
  const entry: CachedResponse = {
    body,
    status,
    headers,
    createdAt: Date.now(),
  }

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

/** Idempotency-Key header kiolvasása (max 128 karakter). */
export function getIdempotencyKey(request: Request): string | null {
  const key = request.headers.get('Idempotency-Key')?.trim()
  if (!key || key.length > 128) return null
  return key
}
