/**
 * Admin belépés lockout állapota IP szerint (nem csak 429 számláló).
 * 5 hibás kulcs → 15 perc zár + egyszeri ADMIN_EMAIL riasztás.
 */

import { logger } from '@/lib/logger'
import { getRedis, isRedisConfigured } from '@/lib/redis'
import { getClientIp } from '@/lib/request-ip'
import { sendSuspiciousLoginAlert } from '@/lib/login-alert-email'

export const ADMIN_LOCK_MAX_FAILURES = 5
export const ADMIN_LOCK_MS = 15 * 60 * 1000
const REDIS_PREFIX = 'admin:lockout:'

type Entry = {
  failedCount: number
  lockedUntil: number | null
  alertSent: boolean
}

const store = new Map<string, Entry>()

export type AdminLockoutStatus =
  | { locked: false }
  | { locked: true; lockedUntil: Date; retryAfterSec: number }

function statusFromEntry(entry: Entry | undefined, now = Date.now()): AdminLockoutStatus {
  if (!entry?.lockedUntil || entry.lockedUntil <= now) return { locked: false }
  return {
    locked: true,
    lockedUntil: new Date(entry.lockedUntil),
    retryAfterSec: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
  }
}

function freshEntry(): Entry {
  return { failedCount: 0, lockedUntil: null, alertSent: false }
}

function normalizeEntry(entry: Entry | undefined, now: number): Entry {
  if (!entry) return freshEntry()
  if (entry.lockedUntil && entry.lockedUntil <= now) return freshEntry()
  return entry
}

export async function getAdminLoginLockout(request: Request): Promise<AdminLockoutStatus> {
  const id = getClientIp(request)
  const now = Date.now()
  if (isRedisConfigured()) {
    try {
      const redis = getRedis()
      if (redis) {
        const entry = (await redis.get<Entry>(REDIS_PREFIX + id)) ?? undefined
        return statusFromEntry(normalizeEntry(entry, now), now)
      }
    } catch (err) {
      logger.warn({ err }, 'admin lockout Redis get failed, memory fallback')
    }
  }
  return statusFromEntry(normalizeEntry(store.get(id), now), now)
}

async function saveEntry(id: string, entry: Entry): Promise<void> {
  const ttl = entry.lockedUntil
    ? Math.max(1000, entry.lockedUntil - Date.now())
    : ADMIN_LOCK_MS
  if (isRedisConfigured()) {
    try {
      const redis = getRedis()
      if (redis) {
        await redis.set(REDIS_PREFIX + id, entry, { px: ttl })
        return
      }
    } catch (err) {
      logger.warn({ err }, 'admin lockout Redis set failed, memory fallback')
    }
  }
  store.set(id, entry)
}

export async function recordAdminLoginFailure(request: Request): Promise<AdminLockoutStatus & { justLocked: boolean }> {
  const id = getClientIp(request)
  const now = Date.now()
  let entry = freshEntry()
  if (isRedisConfigured()) {
    try {
      const redis = getRedis()
      if (redis) {
        entry = normalizeEntry((await redis.get<Entry>(REDIS_PREFIX + id)) ?? undefined, now)
      } else {
        entry = normalizeEntry(store.get(id), now)
      }
    } catch (err) {
      logger.warn({ err }, 'admin lockout Redis read failed, memory fallback')
      entry = normalizeEntry(store.get(id), now)
    }
  } else {
    entry = normalizeEntry(store.get(id), now)
  }

  const already = statusFromEntry(entry, now)
  if (already.locked) return { ...already, justLocked: false }

  entry.failedCount += 1
  const shouldLock = entry.failedCount >= ADMIN_LOCK_MAX_FAILURES
  if (shouldLock) {
    entry.lockedUntil = now + ADMIN_LOCK_MS
    const justLocked = !entry.alertSent
    entry.alertSent = true
    await saveEntry(id, entry)
    if (justLocked) {
      try {
        await sendSuspiciousLoginAlert({
          kind: 'admin',
          ip: id,
          userAgent: request.headers.get('user-agent'),
          failedCount: entry.failedCount,
          lockedUntil: new Date(entry.lockedUntil),
        })
      } catch (err) {
        logger.warn({ err }, 'admin lockout alert failed')
      }
    }
    return {
      locked: true,
      lockedUntil: new Date(entry.lockedUntil),
      retryAfterSec: Math.ceil(ADMIN_LOCK_MS / 1000),
      justLocked,
    }
  }

  await saveEntry(id, entry)
  return { locked: false, justLocked: false }
}

/** Teszt: in-memory lockout tároló ürítése. */
export function resetAdminLoginLockoutStoreForTests(): void {
  store.clear()
}

export async function clearAdminLoginLockout(request: Request): Promise<void> {
  const id = getClientIp(request)
  if (isRedisConfigured()) {
    try {
      const redis = getRedis()
      if (redis) {
        await redis.del(REDIS_PREFIX + id)
        return
      }
    } catch (err) {
      logger.warn({ err }, 'admin lockout Redis del failed, memory fallback')
    }
  }
  store.delete(id)
}
