/**
 * Felhasználói fiókzárolás – brute-force ellen, IP-től függetlenül.
 * 10 hibás jelszó → 15 perc lock + egyszeri admin e-mail.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendSuspiciousLoginAlert } from '@/lib/login-alert-email'

export const ACCOUNT_LOCK_MAX_FAILURES = 10
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000
export const TOO_MANY_LOGIN_ATTEMPTS_ERROR = 'Too many login attempts. Try again later.'

export type LockoutStatus =
  | { locked: false }
  | { locked: true; lockedUntil: Date; retryAfterSec: number }

function asLockout(lockedUntil: Date | null | undefined, now = Date.now()): LockoutStatus {
  if (!lockedUntil) return { locked: false }
  const until = lockedUntil.getTime()
  if (until <= now) return { locked: false }
  return {
    locked: true,
    lockedUntil,
    retryAfterSec: Math.max(1, Math.ceil((until - now) / 1000)),
  }
}

export function getUserLockoutStatus(user: {
  lockedUntil: Date | null
}): LockoutStatus {
  return asLockout(user.lockedUntil)
}

export async function getUserLockoutById(userId: string): Promise<LockoutStatus> {
  if (!isDbConfigured()) return { locked: false }
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  })
  return asLockout(row?.lockedUntil ?? null)
}

export async function recordUserLoginFailure(params: {
  userId: string
  email: string
  ip: string
  userAgent?: string | null
}): Promise<LockoutStatus & { justLocked: boolean }> {
  if (!isDbConfigured()) return { locked: false, justLocked: false }

  const now = new Date()
  const existing = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { failedLoginCount: true, lockedUntil: true },
  })
  if (!existing) return { locked: false, justLocked: false }

  const active = asLockout(existing.lockedUntil, now.getTime())
  if (active.locked) return { ...active, justLocked: false }

  const lockExpired = Boolean(existing.lockedUntil && existing.lockedUntil.getTime() <= now.getTime())
  const nextCount = (lockExpired ? 0 : existing.failedLoginCount) + 1
  const shouldLock = nextCount >= ACCOUNT_LOCK_MAX_FAILURES
  const lockedUntil = shouldLock ? new Date(now.getTime() + ACCOUNT_LOCK_MS) : null

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      failedLoginCount: nextCount,
      lastFailedLoginAt: now,
      lastFailedLoginIp: params.ip.slice(0, 64),
      lockedUntil,
      ...(shouldLock ? { lockAlertSentAt: now } : {}),
    },
  })

  if (shouldLock && lockedUntil) {
    try {
      await sendSuspiciousLoginAlert({
        kind: 'user',
        email: params.email,
        ip: params.ip,
        userAgent: params.userAgent,
        failedCount: nextCount,
        lockedUntil,
      })
    } catch (err) {
      logger.warn({ err }, 'suspicious login alert failed')
    }
    return { locked: true, lockedUntil, retryAfterSec: Math.ceil(ACCOUNT_LOCK_MS / 1000), justLocked: true }
  }

  return { locked: false, justLocked: false }
}

export async function clearUserLockout(userId: string): Promise<void> {
  if (!isDbConfigured()) return
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lockAlertSentAt: null,
      lastFailedLoginAt: null,
      lastFailedLoginIp: null,
    },
  })
}

export function tooManyLoginAttemptsResponse(opts?: {
  locked?: boolean
  retryAfterSec?: number
}): { body: Record<string, unknown>; status: 429; headers: Record<string, string> } {
  const headers: Record<string, string> = {}
  if (opts?.retryAfterSec && opts.retryAfterSec > 0) {
    headers['Retry-After'] = String(opts.retryAfterSec)
  }
  const body: Record<string, unknown> = { error: TOO_MANY_LOGIN_ATTEMPTS_ERROR }
  if (opts?.locked) {
    body.locked = true
    if (opts.retryAfterSec && opts.retryAfterSec > 0) body.retryAfterSec = opts.retryAfterSec
  }
  return { body, status: 429, headers }
}
