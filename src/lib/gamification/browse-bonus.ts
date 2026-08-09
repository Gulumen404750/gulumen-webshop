import {
  BROWSE_BONUS_COOLDOWN_MS,
  BROWSE_DAILY_MAX_BONUSES,
  BROWSE_DAILY_TARGET_SECONDS,
} from './constants'

export type BrowseActivityState = {
  bonusGrantedCount: number
  lastBonusGrantedAt: Date | null
  sessionProgressSeconds: number
}

export function isBrowseBonusCooldownElapsed(
  lastBonusGrantedAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastBonusGrantedAt) return true
  return now.getTime() - lastBonusGrantedAt.getTime() >= BROWSE_BONUS_COOLDOWN_MS
}

export function canGrantBrowseBonus(
  activity: BrowseActivityState,
  now: Date = new Date()
): boolean {
  if (activity.bonusGrantedCount >= BROWSE_DAILY_MAX_BONUSES) return false
  if (activity.sessionProgressSeconds < BROWSE_DAILY_TARGET_SECONDS) return false
  return isBrowseBonusCooldownElapsed(activity.lastBonusGrantedAt, now)
}

export function nextBrowseBonusIndex(bonusGrantedCount: number): number {
  return bonusGrantedCount + 1
}

export function browseBonusIdempotencyKey(
  userId: string,
  dateKey: string,
  bonusIndex: number
): string {
  return `event:browse-5min:${userId}:${dateKey}:${bonusIndex}`
}

export function browseBonusLedgerKey(
  userId: string,
  dateKey: string,
  bonusIndex: number
): string {
  return `browse-5min:${userId}:${dateKey}:${bonusIndex}`
}
