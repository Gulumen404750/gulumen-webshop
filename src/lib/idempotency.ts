/**
 * Checkout idempotencia: ugyanazzal az Idempotency-Key headerrel
 * érkező kérésnél a korábbi választ adjuk vissza (új rendelés nélkül).
 * Egyelőre in-memory Map; később Redis/DB.
 */

const TTL_MS = 24 * 60 * 60 * 1000 // 24 óra

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
export function getIdempotentResponse(key: string): { body: unknown; status: number; headers: Record<string, string> } | null {
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
export function setIdempotentResponse(
  key: string,
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): void {
  pruneExpired()
  store.set(key, {
    body,
    status,
    headers,
    createdAt: Date.now(),
  })
}

/** Idempotency-Key header kiolvasása (max 128 karakter). */
export function getIdempotencyKey(request: Request): string | null {
  const key = request.headers.get('Idempotency-Key')?.trim()
  if (!key || key.length > 128) return null
  return key
}
