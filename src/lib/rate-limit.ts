/**
 * IP-based rate limit – Upstash Redis sliding window (multi-instance safe).
 * Fallback: in-memory Map ha nincs UPSTASH_REDIS_* env.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { getRedis, isRedisConfigured } from '@/lib/redis'

export type RateLimitResult = { ok: true } | { ok: false; status: 429 }

export type RateLimitPreset = 'default' | 'auth' | 'adminLogin' | 'heartbeat'

const PRESETS: Record<
  RateLimitPreset,
  { windowMs: number; max: number; windowLabel: `${number} ${'s' | 'm' | 'h' | 'd'}` }
> = {
  default: { windowMs: 60_000, max: 60, windowLabel: '1 m' },
  auth: { windowMs: 60_000, max: 20, windowLabel: '1 m' },
  adminLogin: { windowMs: 10 * 60_000, max: 5, windowLabel: '10 m' },
  /** Max 3 tick/perc – anti-abuse (IP). User/IP velocity a heartbeat route-ban is fut. */
  heartbeat: { windowMs: 60_000, max: 3, windowLabel: '1 m' },
}

const memoryStores = new Map<string, Map<string, { count: number; resetAt: number }>>()
const redisLimiters = new Map<string, Ratelimit>()

function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp
  return 'unknown'
}

function getMemoryStore(preset: RateLimitPreset): Map<string, { count: number; resetAt: number }> {
  let store = memoryStores.get(preset)
  if (!store) {
    store = new Map()
    memoryStores.set(preset, store)
  }
  return store
}

function memoryLimit(request: Request, preset: RateLimitPreset): RateLimitResult {
  const { windowMs, max } = PRESETS[preset]
  const now = Date.now()
  const id = getClientId(request)
  const store = getMemoryStore(preset)
  let entry = store.get(id)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(id, entry)
    return { ok: true }
  }
  entry.count += 1
  if (entry.count > max) {
    return { ok: false, status: 429 }
  }
  return { ok: true }
}

function getRedisLimiter(preset: RateLimitPreset): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  let limiter = redisLimiters.get(preset)
  if (!limiter) {
    const cfg = PRESETS[preset]
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.max, cfg.windowLabel),
      prefix: `rl:${preset}`,
      analytics: false,
    })
    redisLimiters.set(preset, limiter)
  }
  return limiter
}

/**
 * Rate limit check. Preferáld a Redis sliding window-t multi-instance környezetben.
 */
export async function rateLimit(
  request: Request,
  preset: RateLimitPreset = 'default'
): Promise<RateLimitResult> {
  if (isRedisConfigured()) {
    try {
      const limiter = getRedisLimiter(preset)
      if (limiter) {
        const id = getClientId(request)
        const { success } = await limiter.limit(id)
        if (!success) return { ok: false, status: 429 }
        return { ok: true }
      }
    } catch (err) {
      console.warn('[rate-limit] Redis error, falling back to memory:', err)
    }
  }
  return memoryLimit(request, preset)
}
