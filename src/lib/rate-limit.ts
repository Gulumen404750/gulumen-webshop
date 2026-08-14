/**
 * IP-based rate limit – Upstash Redis sliding window (multi-instance safe).
 * Fallback: in-memory Map ha nincs UPSTASH_REDIS_* env.
 *
 * Használat:
 *   await rateLimit(request)
 *   await rateLimit(request, { maxPerWindow: 30, windowMs: 60_000 })
 *   await rateLimit(request, { preset: 'auth' })
 */

import { Ratelimit } from '@upstash/ratelimit'
import { getRedis, isRedisConfigured } from '@/lib/redis'

export type RateLimitResult = { ok: true } | { ok: false; status: 429 }

export type RateLimitPreset =
  | 'default'
  | 'auth'
  | 'adminLogin'
  | 'adminTotp'
  | 'adminResetRequest'
  | 'adminResetConfirm'
  | 'heartbeat'

export type RateLimitOptions = {
  maxPerWindow?: number
  windowMs?: number
  preset?: RateLimitPreset
}

const PRESETS: Record<RateLimitPreset, { windowMs: number; max: number }> = {
  default: { windowMs: 60_000, max: 60 },
  auth: { windowMs: 60_000, max: 20 },
  adminLogin: { windowMs: 10 * 60_000, max: 5 },
  adminTotp: { windowMs: 10 * 60_000, max: 10 },
  adminResetRequest: { windowMs: 60 * 60_000, max: 3 },
  adminResetConfirm: { windowMs: 15 * 60_000, max: 10 },
  heartbeat: { windowMs: 60_000, max: 30 },
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

function resolveLimits(options?: RateLimitOptions): { windowMs: number; max: number; key: string } {
  if (options?.preset) {
    const p = PRESETS[options.preset]
    return { windowMs: p.windowMs, max: p.max, key: `preset:${options.preset}` }
  }
  const windowMs = options?.windowMs ?? 60_000
  const max = options?.maxPerWindow ?? 60
  return { windowMs, max, key: `custom:${max}:${windowMs}` }
}

function windowLabel(windowMs: number): `${number} s` | `${number} m` {
  if (windowMs % 60_000 === 0) {
    return `${windowMs / 60_000} m` as `${number} m`
  }
  return `${Math.max(1, Math.round(windowMs / 1000))} s` as `${number} s`
}

function memoryLimit(
  request: Request,
  windowMs: number,
  max: number,
  storeKey: string
): RateLimitResult {
  const now = Date.now()
  const id = getClientId(request)
  let store = memoryStores.get(storeKey)
  if (!store) {
    store = new Map()
    memoryStores.set(storeKey, store)
  }
  let entry = store.get(id)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(id, entry)
    return { ok: true }
  }
  entry.count += 1
  if (entry.count > max) return { ok: false, status: 429 }
  return { ok: true }
}

function getRedisLimiter(storeKey: string, max: number, windowMs: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  let limiter = redisLimiters.get(storeKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, windowLabel(windowMs)),
      prefix: `rl:${storeKey}`,
      analytics: false,
    })
    redisLimiters.set(storeKey, limiter)
  }
  return limiter
}

let warnedMissingRedisForAdmin = false

export async function rateLimit(
  request: Request,
  options?: RateLimitOptions
): Promise<RateLimitResult> {
  const { windowMs, max, key } = resolveLimits(options)

  if (
    process.env.NODE_ENV === 'production' &&
    (options?.preset === 'adminLogin' || options?.preset === 'adminTotp') &&
    !isRedisConfigured() &&
    !warnedMissingRedisForAdmin
  ) {
    warnedMissingRedisForAdmin = true
    console.error(
      '[rate-limit] UPSTASH Redis unset; admin login limits are per-instance. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    )
  }

  if (isRedisConfigured()) {
    try {
      const limiter = getRedisLimiter(key, max, windowMs)
      if (limiter) {
        const { success } = await limiter.limit(getClientId(request))
        if (!success) return { ok: false, status: 429 }
        return { ok: true }
      }
    } catch (err) {
      console.warn('[rate-limit] Redis error, memory fallback:', err)
    }
  }

  return memoryLimit(request, windowMs, max, key)
}
