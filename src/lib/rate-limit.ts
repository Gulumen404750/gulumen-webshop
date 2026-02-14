/**
 * In-memory IP-based rate limit. For production consider Redis.
 * 60 requests per minute per IP; returns 429 when exceeded.
 */

const windowMs = 60 * 1000
const maxPerWindow = 60

const store = new Map<string, { count: number; resetAt: number }>()

function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp
  return 'unknown'
}

export function rateLimit(request: Request): { ok: true } | { ok: false; status: 429 } {
  const now = Date.now()
  const id = getClientId(request)
  let entry = store.get(id)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(id, entry)
    return { ok: true }
  }
  entry.count += 1
  if (entry.count > maxPerWindow) {
    return { ok: false, status: 429 }
  }
  return { ok: true }
}
