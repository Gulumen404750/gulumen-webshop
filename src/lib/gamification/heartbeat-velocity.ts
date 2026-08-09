/**
 * Szerveroldali heartbeat velocity check – user + IP.
 * Max 3 tick / perc (sliding window). Nem bízik a kliens flagekben.
 */

import { getRedis, isRedisConfigured } from '@/lib/redis'

/** Max elfogadott heartbeat tick / ablak. */
export const HEARTBEAT_VELOCITY_MAX_TICKS = 3
/** Ablak hossza (ms) – 60 mp. */
export const HEARTBEAT_VELOCITY_WINDOW_MS = 60_000

type WindowEntry = { timestamps: number[] }

const memoryStore = new Map<string, WindowEntry>()

function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - HEARTBEAT_VELOCITY_WINDOW_MS
  return timestamps.filter((t) => t > cutoff)
}

function memoryAllow(key: string, now: number): { ok: true } | { ok: false; retryAfterMs: number } {
  const entry = memoryStore.get(key) ?? { timestamps: [] }
  entry.timestamps = prune(entry.timestamps, now)
  if (entry.timestamps.length >= HEARTBEAT_VELOCITY_MAX_TICKS) {
    const oldest = entry.timestamps[0] ?? now
    const retryAfterMs = Math.max(0, HEARTBEAT_VELOCITY_WINDOW_MS - (now - oldest))
    memoryStore.set(key, entry)
    return { ok: false, retryAfterMs }
  }
  entry.timestamps.push(now)
  memoryStore.set(key, entry)
  return { ok: true }
}

async function redisAllow(
  key: string,
  now: number
): Promise<{ ok: true } | { ok: false; retryAfterMs: number } | null> {
  const redis = getRedis()
  if (!redis) return null
  const redisKey = `hb:vel:${key}`
  await redis.zremrangebyscore(redisKey, 0, now - HEARTBEAT_VELOCITY_WINDOW_MS)
  const count = await redis.zcard(redisKey)
  if ((count ?? 0) >= HEARTBEAT_VELOCITY_MAX_TICKS) {
    const oldest = await redis.zrange(redisKey, 0, 0, { withScores: true })
    let retryAfterMs = HEARTBEAT_VELOCITY_WINDOW_MS
    if (Array.isArray(oldest) && oldest.length >= 2) {
      const oldestScore = Number(oldest[1])
      if (Number.isFinite(oldestScore)) {
        retryAfterMs = Math.max(0, HEARTBEAT_VELOCITY_WINDOW_MS - (now - oldestScore))
      }
    }
    return { ok: false, retryAfterMs }
  }
  await redis.zadd(redisKey, {
    score: now,
    member: `${now}:${Math.random().toString(36).slice(2, 8)}`,
  })
  await redis.pexpire(redisKey, HEARTBEAT_VELOCITY_WINDOW_MS)
  return { ok: true }
}

export type VelocityCheckResult =
  | { ok: true }
  | { ok: false; reason: 'velocity_user' | 'velocity_ip'; retryAfterMs: number }

/**
 * User + IP velocity: mindkettőnek át kell mennie (max 3 tick/perc).
 */
export async function checkHeartbeatVelocity(input: {
  userId: string
  ip: string
}): Promise<VelocityCheckResult> {
  const now = Date.now()
  const userKey = `u:${input.userId}`
  const ipKey = `ip:${input.ip || 'unknown'}`

  if (isRedisConfigured()) {
    try {
      const userResult = await redisAllow(userKey, now)
      if (userResult && !userResult.ok) {
        return { ok: false, reason: 'velocity_user', retryAfterMs: userResult.retryAfterMs }
      }
      const ipResult = await redisAllow(ipKey, now)
      if (ipResult && !ipResult.ok) {
        return { ok: false, reason: 'velocity_ip', retryAfterMs: ipResult.retryAfterMs }
      }
      if (userResult && ipResult) return { ok: true }
    } catch (err) {
      console.warn('[heartbeat-velocity] Redis error, memory fallback:', err)
    }
  }

  const userMem = memoryAllow(userKey, now)
  if (!userMem.ok) {
    return { ok: false, reason: 'velocity_user', retryAfterMs: userMem.retryAfterMs }
  }
  const ipMem = memoryAllow(ipKey, now)
  if (!ipMem.ok) {
    return { ok: false, reason: 'velocity_ip', retryAfterMs: ipMem.retryAfterMs }
  }
  return { ok: true }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp
  return 'unknown'
}
