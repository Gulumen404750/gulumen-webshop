/**
 * Stricter rate limit for login (brute-force protection).
 * Max 10 failed attempts per 10 minutes per IP. Success resets the failed counter.
 * In-memory only (MVP); for multi-instance consider Upstash Redis / Vercel KV.
 */

import { logger } from '@/lib/logger'

const WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const MAX_FAILED_PER_WINDOW = 10

type Entry = { failedCount: number; resetAt: number }

const store = new Map<string, Entry>()

function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp
  return 'unknown'
}

/**
 * Check if the client is over the limit (before attempting login).
 * Returns ok: false with status 429 when too many failed attempts in the window.
 */
export function loginRateLimitCheck(
  request: Request
): { ok: true } | { ok: false; status: 429 } {
  const now = Date.now()
  const id = getClientId(request)
  let entry = store.get(id)
  if (!entry || now >= entry.resetAt) {
    entry = { failedCount: 0, resetAt: now + WINDOW_MS }
    store.set(id, entry)
  }
  if (entry.failedCount >= MAX_FAILED_PER_WINDOW) {
    logger.warn({ ip: id, failedCount: entry.failedCount }, 'Login rate limit exceeded')
    return { ok: false, status: 429 }
  }
  return { ok: true }
}

/** Call on failed login (wrong password / user not found). */
export function loginRateLimitRecordFailure(request: Request): void {
  const now = Date.now()
  const id = getClientId(request)
  let entry = store.get(id)
  if (!entry || now >= entry.resetAt) {
    entry = { failedCount: 0, resetAt: now + WINDOW_MS }
    store.set(id, entry)
  }
  entry.failedCount += 1
  store.set(id, entry)
}

/** Call on successful login to reset failed counter for this IP. */
export function loginRateLimitRecordSuccess(request: Request): void {
  const id = getClientId(request)
  store.delete(id)
}
