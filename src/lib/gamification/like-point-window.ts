import { prisma } from '@/lib/prisma'
import { type Prisma } from '@prisma/client'
import {
  DAILY_LIKE_TARGET,
  LIKE_BONUS_WINDOW_MS,
} from './constants'

export type LikePointWindowState = {
  qualifyingLikeCount: number
  qualifyingLikeTarget: number
  bonusGranted: boolean
  windowStartedAt: Date
  windowEndsAt: Date
  pointLimitReached: boolean
  canEarnProgress: boolean
}

function windowEndsAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + LIKE_BONUS_WINDOW_MS)
}

function isWindowExpired(startedAt: Date, now: Date): boolean {
  return now.getTime() - startedAt.getTime() >= LIKE_BONUS_WINDOW_MS
}

export function evaluateLikeWindow(
  window: {
    windowStartedAt: Date
    qualifyingLikeCount: number
    bonusGranted: boolean
  },
  now: Date = new Date()
): LikePointWindowState {
  const expired = isWindowExpired(window.windowStartedAt, now)
  const count = expired ? 0 : window.qualifyingLikeCount
  const bonusGranted = expired ? false : window.bonusGranted
  const startedAt = expired ? now : window.windowStartedAt
  const endsAt = windowEndsAt(startedAt)
  const pointLimitReached = !expired && count >= DAILY_LIKE_TARGET
  const canEarnProgress = !expired && count < DAILY_LIKE_TARGET && !bonusGranted

  return {
    qualifyingLikeCount: count,
    qualifyingLikeTarget: DAILY_LIKE_TARGET,
    bonusGranted,
    windowStartedAt: startedAt,
    windowEndsAt: endsAt,
    pointLimitReached,
    canEarnProgress,
  }
}

/** Aktív vagy új 12 órás ablak – tranzakción belül hívandó. */
export async function ensureLikePointWindow(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date = new Date()
) {
  const existing = await tx.userLikePointWindow.findUnique({ where: { userId } })
  if (!existing) {
    return tx.userLikePointWindow.create({
      data: { userId, windowStartedAt: now },
    })
  }
  if (isWindowExpired(existing.windowStartedAt, now)) {
    return tx.userLikePointWindow.update({
      where: { userId },
      data: {
        windowStartedAt: now,
        qualifyingLikeCount: 0,
        bonusGranted: false,
      },
    })
  }
  return existing
}

export async function getLikePointWindowStatus(
  userId: string
): Promise<LikePointWindowState | null> {
  const row = await prisma.userLikePointWindow.findUnique({ where: { userId } })
  if (!row) {
    const now = new Date()
    return {
      qualifyingLikeCount: 0,
      qualifyingLikeTarget: DAILY_LIKE_TARGET,
      bonusGranted: false,
      windowStartedAt: now,
      windowEndsAt: windowEndsAt(now),
      pointLimitReached: false,
      canEarnProgress: true,
    }
  }
  return evaluateLikeWindow(row)
}

export function likeWindowBonusIdempotencyKey(userId: string, windowStartedAt: Date): string {
  return `event:like-window:${userId}:${windowStartedAt.getTime()}`
}

export function likeWindowLedgerKey(userId: string, windowStartedAt: Date): string {
  return `like-window:${userId}:${windowStartedAt.getTime()}`
}
