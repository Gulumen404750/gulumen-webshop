/**
 * Manuális kuponválasztás: egyszerre egy kupon, max. 15%.
 * A hűségkedvezmény nem kuponválasztás: automatikus, más kedvezményre ráépül.
 */

import {
  ALLOW_CAT_REGISTRATION_STACK,
  BIRTHDAY_COUPON_PERCENT,
  CAT_COUPON_PERCENT,
  MAX_COMBINED_COUPON_PERCENT,
  REGISTRATION_COUPON_PERCENT,
  WELCOME_CHECKOUT_COUPON_PERCENT,
  capCombinedCouponPercent,
  exclusiveCouponIds,
  isCatRegistrationStackBlocked,
  isCouponStackingBlocked,
} from '@/lib/coupon-config'

export {
  ALLOW_CAT_REGISTRATION_STACK,
  exclusiveCouponIds,
  isCatRegistrationStackBlocked,
  isCouponStackingBlocked,
}

export type SelectableCouponId =
  | 'cat'
  | 'registration'
  | 'loyalty'
  | 'welcome'
  | 'birthday'
  | 'gamification'
  | `gamification:${string}`

const GAMIFICATION_ID_PREFIX = 'gamification:'

export function isGamificationCouponId(id: string): boolean {
  return id === 'gamification' || id.startsWith(GAMIFICATION_ID_PREFIX)
}

export function gamificationCouponId(code: string): SelectableCouponId {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '')
  return normalized ? `${GAMIFICATION_ID_PREFIX}${normalized}` : 'gamification'
}

export function toCheckoutSelectedCouponId(id: SelectableCouponId): SelectableCouponId {
  return isGamificationCouponId(id) ? 'gamification' : id
}

export type SelectableCoupon = {
  id: SelectableCouponId
  /** Megjelenített cím. */
  label: string
  /** 0–1 közötti százalék. */
  percent: number
  /** DB kuponkód (születésnapi). */
  code?: string
  /** Extra leírás (pl. érvényesség). */
  hint?: string
}

export type CouponSelectionResult = {
  selectedIds: SelectableCouponId[]
  /** Kiválasztott kuponok nyers összege (plafon előtt). */
  rawPercent: number
  /** Plafonált % a számoláshoz. */
  finalPercent: number
  capped: boolean
  birthdayCode?: string
  gamificationCode?: string
  useWelcome: boolean
  useLoyalty: boolean
  useCat: boolean
  useRegistration: boolean
  useGamification: boolean
}

export { MAX_COMBINED_COUPON_PERCENT, capCombinedCouponPercent }

/** DB kupon % (10) vagy tört (0.1) → 0–1. */
export function normalizeCouponPercent(percent: number | undefined, fallback: number): number {
  if (typeof percent === 'number' && Number.isFinite(percent) && percent > 0) {
    return percent > 1 ? percent / 100 : percent
  }
  return fallback
}

/** Összegzés plafonnal. */
export function calculateSelectedCouponPercent(
  coupons: SelectableCoupon[],
  selectedIds: ReadonlySet<string> | SelectableCouponId[]
): CouponSelectionResult {
  const selected = new Set(selectedIds)
  const picked = coupons.filter((c) => selected.has(c.id) && c.id !== 'loyalty')
  const rawPercent = picked.reduce((s, c) => s + (c.percent > 0 ? c.percent : 0), 0)
  const finalPercent = capCombinedCouponPercent(rawPercent)
  const birthday = picked.find((c) => c.id === 'birthday')
  const gamification = picked.find((c) => isGamificationCouponId(c.id))

  return {
    selectedIds: picked.map((c) => c.id),
    rawPercent,
    finalPercent,
    capped: rawPercent > MAX_COMBINED_COUPON_PERCENT + 1e-9,
    birthdayCode: birthday?.code,
    gamificationCode: gamification?.code,
    useWelcome: selected.has('welcome'),
    useLoyalty: false,
    useCat: selected.has('cat'),
    useRegistration: selected.has('registration'),
    useGamification: Boolean(gamification),
  }
}

/**
 * Új kupon kijelölése: összevonás tilos, és egy kupon sem lépheti át a 15%-ot.
 * A leválasztás (deselect) mindig engedélyezett.
 */
export function canToggleCoupon(
  coupons: SelectableCoupon[],
  selectedIds: ReadonlySet<SelectableCouponId>,
  toggleId: SelectableCouponId,
  turningOn: boolean
): boolean {
  if (!turningOn) return true
  if (toggleId === 'loyalty') return true
  if (selectedIds.has(toggleId)) return true
  const next = new Set(selectedIds)
  next.add(toggleId)
  if (isCouponStackingBlocked(next) || isCatRegistrationStackBlocked(next)) return false
  const raw = coupons
    .filter((c) => next.has(c.id) && c.id !== 'loyalty')
    .reduce((s, c) => s + c.percent, 0)
  return raw <= MAX_COMBINED_COUPON_PERCENT + 1e-9
}

export function buildPromoCoupons(input: {
  catClaimed: boolean
  registrationClaimed: boolean
  loyaltyPercent?: number
  welcomeEligible?: boolean
  birthday?: { code: string; percent?: number; validUntil?: string } | null
  gamification?:
    | { code: string; percent?: number; validUntil?: string; label?: string }
    | Array<{ code: string; percent?: number; validUntil?: string; label?: string }>
    | null
  labels: {
    cat: string
    registration: string
    loyalty: string
    welcome: string
    birthday: string
    gamification?: string
  }
}): SelectableCoupon[] {
  const out: SelectableCoupon[] = []
  if (input.catClaimed) {
    out.push({
      id: 'cat',
      label: input.labels.cat,
      percent: CAT_COUPON_PERCENT,
    })
  }
  if (input.registrationClaimed) {
    out.push({
      id: 'registration',
      label: input.labels.registration,
      percent: REGISTRATION_COUPON_PERCENT,
    })
  }
  if (input.welcomeEligible) {
    out.push({
      id: 'welcome',
      label: input.labels.welcome,
      percent: WELCOME_CHECKOUT_COUPON_PERCENT,
    })
  }
  if (input.birthday?.code) {
    const p = normalizeCouponPercent(input.birthday.percent, BIRTHDAY_COUPON_PERCENT)
    out.push({
      id: 'birthday',
      label: input.labels.birthday,
      percent: capCombinedCouponPercent(p),
      code: input.birthday.code,
      hint: input.birthday.validUntil,
    })
  }
  const gamificationItems = Array.isArray(input.gamification)
    ? input.gamification
    : input.gamification?.code
      ? [input.gamification]
      : []
  const seenCodes = new Set<string>()
  for (const item of gamificationItems) {
    const code = item.code?.trim()
    if (!code) continue
    const key = code.toUpperCase()
    if (seenCodes.has(key)) continue
    seenCodes.add(key)
    const p = normalizeCouponPercent(item.percent, 0.1)
    out.push({
      id: gamificationCouponId(code),
      label: item.label || input.labels.gamification || '',
      percent: capCombinedCouponPercent(p),
      code,
      hint: item.validUntil,
    })
  }
  return out
}
