/**
 * Napi 5 perc böngészés – percenkénti tick, max 2 bónusz/nap, 12 órás cooldown.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  BROWSE_DAILY_MAX_BONUSES,
  BROWSE_DAILY_TARGET_SECONDS,
  HEARTBEAT_MIN_INTERVAL_MS,
  HEARTBEAT_TICK_SECONDS,
} from './constants'
import {
  canGrantBrowseBonus,
  nextBrowseBonusIndex,
  browseBonusIdempotencyKey,
} from './browse-bonus'
import { getGamificationDate } from './dates'
import { enqueuePointEvent } from './point-event-queue'

export type HeartbeatInput = {
  userId: string
  isVisible: boolean
  hasFocus: boolean
}

export type HeartbeatResult = {
  accepted: boolean
  activeSecondsToday: number
  sessionProgressSeconds: number
  targetSeconds: number
  bonusesGrantedToday: number
  maxBonusesPerDay: number
  bonusQueued: boolean
  reason?: string
}

export async function recordBrowseHeartbeat(input: HeartbeatInput): Promise<HeartbeatResult> {
  const emptyResult = (reason?: string): HeartbeatResult => ({
    accepted: false,
    activeSecondsToday: 0,
    sessionProgressSeconds: 0,
    targetSeconds: BROWSE_DAILY_TARGET_SECONDS,
    bonusesGrantedToday: 0,
    maxBonusesPerDay: BROWSE_DAILY_MAX_BONUSES,
    bonusQueued: false,
    reason,
  })

  if (!isDbConfigured()) {
    const { devRecordBrowseHeartbeat } = await import('@/lib/dev-gamification')
    return devRecordBrowseHeartbeat(input)
  }

  if (!input.isVisible || !input.hasFocus) return emptyResult('inactive_tab')

  const activityDate = getGamificationDate()
  const now = new Date()
  const dateKey = activityDate.toISOString().slice(0, 10)

  const existing = await prisma.userDailyActivity.findUnique({
    where: { userId_activityDate: { userId: input.userId, activityDate } },
  })

  if (existing?.lastHeartbeatAt) {
    const elapsed = now.getTime() - existing.lastHeartbeatAt.getTime()
    if (elapsed < HEARTBEAT_MIN_INTERVAL_MS) {
      return {
        accepted: false,
        activeSecondsToday: existing.activeSeconds,
        sessionProgressSeconds: existing.sessionProgressSeconds,
        targetSeconds: BROWSE_DAILY_TARGET_SECONDS,
        bonusesGrantedToday: existing.bonusGrantedCount,
        maxBonusesPerDay: BROWSE_DAILY_MAX_BONUSES,
        bonusQueued: false,
        reason: 'too_frequent',
      }
    }
  }

  const activity = await prisma.userDailyActivity.upsert({
    where: { userId_activityDate: { userId: input.userId, activityDate } },
    create: {
      userId: input.userId,
      activityDate,
      activeSeconds: HEARTBEAT_TICK_SECONDS,
      sessionProgressSeconds: HEARTBEAT_TICK_SECONDS,
      lastHeartbeatAt: now,
    },
    update: {
      activeSeconds: { increment: HEARTBEAT_TICK_SECONDS },
      sessionProgressSeconds: { increment: HEARTBEAT_TICK_SECONDS },
      lastHeartbeatAt: now,
    },
  })

  const maxDailySeconds = BROWSE_DAILY_TARGET_SECONDS * BROWSE_DAILY_MAX_BONUSES * 2
  if (activity.activeSeconds > maxDailySeconds) {
    await prisma.userDailyActivity.update({
      where: { userId_activityDate: { userId: input.userId, activityDate } },
      data: { activeSeconds: maxDailySeconds },
    })
  }

  const fresh = await prisma.userDailyActivity.findUniqueOrThrow({
    where: { userId_activityDate: { userId: input.userId, activityDate } },
  })

  let bonusQueued = false
  if (canGrantBrowseBonus(fresh, now)) {
    const bonusIndex = nextBrowseBonusIndex(fresh.bonusGrantedCount)
    const { enqueued } = await enqueuePointEvent({
      userId: input.userId,
      type: 'BROWSE_5MIN',
      idempotencyKey: browseBonusIdempotencyKey(input.userId, dateKey, bonusIndex),
      payload: {
        activeSecondsToday: fresh.activeSeconds,
        sessionProgressSeconds: fresh.sessionProgressSeconds,
        dateKey,
        bonusIndex,
      },
    })
    bonusQueued = enqueued
  }

  return {
    accepted: true,
    activeSecondsToday: Math.min(fresh.activeSeconds, maxDailySeconds),
    sessionProgressSeconds: fresh.sessionProgressSeconds,
    targetSeconds: BROWSE_DAILY_TARGET_SECONDS,
    bonusesGrantedToday: fresh.bonusGrantedCount,
    maxBonusesPerDay: BROWSE_DAILY_MAX_BONUSES,
    bonusQueued,
  }
}
