/**
 * Manuális kuponválasztás: egy százalékos kupon (max. 15%) + opcionális fix Ft kupon.
 * A hűségkedvezmény nem kuponválasztás: automatikus. Pontfizetés és Szerencsekerék
 * a kupon extra mellett nem érvényesül.
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

export function isFixedSelectableCoupon(coupon: Pick<SelectableCoupon, 'fixedHuf'> | undefined): boolean {
  return Boolean(coupon && coupon.fixedHuf && coupon.fixedHuf > 0)
}

/** Wallet / DB kupon: fix Ft, ne 0%-os százalékos kuponnak nézze. */
export function isFixedAmountCoupon(input: {
  discountType?: string | null
  discountPercent?: number | null
  discountValue?: number | null
  fixedHuf?: number | null
}): boolean {
  if (isFixedSelectableCoupon({ fixedHuf: input.fixedHuf ?? undefined })) return true
  if (input.discountType === 'fixed') return true
  if (input.discountType === 'percent') return false
  const percent = Number(input.discountPercent) || 0
  const value = Number(input.discountValue) || 0
  return percent <= 0 && value > 0
}

export function fixedHufFromCoupon(input: {
  discountType?: string | null
  discountPercent?: number | null
  discountValue?: number | null
  fixedHuf?: number | null
}): number | undefined {
  if (!isFixedAmountCoupon(input)) return undefined
  const amount =
    typeof input.fixedHuf === 'number' && input.fixedHuf > 0
      ? input.fixedHuf
      : Number(input.discountValue) || 0
  return amount > 0 ? Math.round(amount) : undefined
}

export function isDbSelectableCouponId(id: string): boolean {
  return id === 'birthday' || isGamificationCouponId(id)
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
  /** Fix Ft kedvezmény (admin kampánykupon). */
  fixedHuf?: number
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
  /** Százalékos kupon kódja (születésnap / 15% GLM / Szerencsekerék). */
  percentCouponCode?: string
  /** Fix Ft kupon kódja. */
  fixedCouponCode?: string
  gamificationFixedHuf?: number
  hasFixedCoupon: boolean
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
  const gamificationPicked = picked.filter((c) => isGamificationCouponId(c.id))
  const gamificationFixed = gamificationPicked.find((c) => isFixedSelectableCoupon(c))
  const gamificationPercent = gamificationPicked.find((c) => !isFixedSelectableCoupon(c))
  const gamification = gamificationFixed ?? gamificationPercent ?? gamificationPicked[0]
  const percentPicked =
    picked.find((c) => c.percent > 0 && !isFixedSelectableCoupon(c)) ?? birthday ?? gamificationPercent

  return {
    selectedIds: picked.map((c) => c.id),
    rawPercent,
    finalPercent,
    capped: rawPercent > MAX_COMBINED_COUPON_PERCENT + 1e-9,
    birthdayCode: birthday?.code,
    gamificationCode: gamification?.code,
    percentCouponCode: percentPicked?.code,
    fixedCouponCode: gamificationFixed?.code,
    gamificationFixedHuf: gamificationFixed?.fixedHuf,
    hasFixedCoupon: Boolean(gamificationFixed),
    useWelcome: selected.has('welcome'),
    useLoyalty: false,
    useCat: selected.has('cat'),
    useRegistration: selected.has('registration'),
    useGamification: Boolean(gamification),
  }
}

/**
 * Következő kijelölés: a százalékos kuponok egymást váltják, a fix Ft kupon megmaradhat mellettük.
 * Egy fix + egy százalékos kupon (DB / Szerencsekerék / promo) együtt élhet.
 */
export function nextCouponSelection(
  coupons: SelectableCoupon[],
  selectedIds: ReadonlySet<SelectableCouponId>,
  toggleId: SelectableCouponId,
  turningOn: boolean
): SelectableCouponId[] {
  if (!turningOn) {
    return [...selectedIds].filter((id) => id !== toggleId)
  }
  if (toggleId === 'loyalty') {
    return Array.from(new Set<SelectableCouponId>([...selectedIds, toggleId]))
  }

  const byId = new Map(coupons.map((c) => [c.id, c]))
  const toggling = byId.get(toggleId)
  const addingFixed = isFixedSelectableCoupon(toggling)
  const next = new Set(selectedIds)
  next.add(toggleId)

  for (const id of [...next]) {
    if (id === toggleId || id === 'loyalty') continue
    const existing = byId.get(id)
    const existingFixed = isFixedSelectableCoupon(existing)
    if (addingFixed && existingFixed) {
      next.delete(id)
      continue
    }
    if (!addingFixed && !existingFixed) {
      next.delete(id)
    }
  }

  return [...next]
}

/**
 * Új kupon kijelölése: két százalékos kupon nem élhet együtt (a második leváltja az elsőt),
 * a fix Ft kupon viszont összevonható egy százalékos kuponnal. A 15%-os plafon megmarad.
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
  const next = nextCouponSelection(coupons, selectedIds, toggleId, true)
  const raw = coupons
    .filter((c) => next.includes(c.id) && c.id !== 'loyalty')
    .reduce((s, c) => s + (c.percent > 0 ? c.percent : 0), 0)
  return raw <= MAX_COMBINED_COUPON_PERCENT + 1e-9
}

export function buildPromoCoupons(input: {
  catClaimed: boolean
  registrationClaimed: boolean
  loyaltyPercent?: number
  welcomeEligible?: boolean
  birthday?: { code: string; percent?: number; validUntil?: string } | null
  gamification?:
    | { code: string; percent?: number; validUntil?: string; label?: string; fixedHuf?: number }
    | Array<{ code: string; percent?: number; validUntil?: string; label?: string; fixedHuf?: number }>
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
    const p = normalizeCouponPercent(item.percent, item.fixedHuf ? 0 : 0.1)
    out.push({
      id: gamificationCouponId(code),
      label: item.label || input.labels.gamification || '',
      percent: item.fixedHuf ? 0 : capCombinedCouponPercent(p),
      code,
      hint: item.validUntil,
      ...(item.fixedHuf ? { fixedHuf: item.fixedHuf } : {}),
    })
  }
  return out
}
