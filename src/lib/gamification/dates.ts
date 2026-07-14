import { GAMIFICATION_TIMEZONE } from './constants'

/** Budapest naptári nap Date-only (UTC midnight stored as date). */
export function getGamificationDate(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GAMIFICATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`)
}

export function formatGamificationDateKey(now: Date = new Date()): string {
  return getGamificationDate(now).toISOString().slice(0, 10)
}
