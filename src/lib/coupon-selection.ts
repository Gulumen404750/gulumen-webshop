/**
 * Manuális kuponválasztás + 20% plafon.
 * A checkout NEM alkalmaz automatikusan kupont – a vásárló jelöli ki.
 * Macska + regisztráció: ALLOW_CAT_REGISTRATION_STACK (kezdeti időszak: együtt 15%).
 */

import {
  ALLOW_CAT_REGISTRATION_STACK,
  BIRTHDAY_COUPON_PERCENT,
  CAT_COUPON_PERCENT,
  MAX_COMBINED_COUPON_PERCENT,
  REGISTRATION_COUPON_PERCENT,
  WELCOME_CHECKOUT_COUPON_PERCENT,
  capCombinedCouponPercent,
  isCatRegistrationStackBlocked,
} from '@/lib/coupon-config'

export { ALLOW_CAT_REGISTRATION_STACK, isCatRegistrationStackBlocked }

export type SelectableCouponId =
  | 'cat'
  | 'registration'
  | 'loyalty'
  | 'welcome'
  | 'birthday'

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
  useWelcome: boolean
  useLoyalty: boolean
  useCat: boolean
  useRegistration: boolean
}

export { MAX_COMBINED_COUPON_PERCENT, capCombinedCouponPercent }

/** Összegzés plafonnal. */
export function calculateSelectedCouponPercent(
  coupons: SelectableCoupon[],
  selectedIds: ReadonlySet<string> | SelectableCouponId[]
): CouponSelectionResult {
  const selected = new Set(selectedIds)
  const picked = coupons.filter((c) => selected.has(c.id))
  const rawPercent = picked.reduce((s, c) => s + (c.percent > 0 ? c.percent : 0), 0)
  const finalPercent = capCombinedCouponPercent(rawPercent)
  const birthday = picked.find((c) => c.id === 'birthday')

  return {
    selectedIds: picked.map((c) => c.id),
    rawPercent,
    finalPercent,
    capped: rawPercent > MAX_COMBINED_COUPON_PERCENT + 1e-9,
    birthdayCode: birthday?.code,
    useWelcome: selected.has('welcome'),
    useLoyalty: selected.has('loyalty'),
    useCat: selected.has('cat'),
    useRegistration: selected.has('registration'),
  }
}

/**
 * Új kupon kijelölése: ha átlépné a 20%-ot, nem engedjük (false).
 * Ha ALLOW_CAT_REGISTRATION_STACK=false, a macska + regisztráció együtt tilos.
 * A leválasztás (deselect) mindig engedélyezett.
 */
export function canToggleCoupon(
  coupons: SelectableCoupon[],
  selectedIds: ReadonlySet<SelectableCouponId>,
  toggleId: SelectableCouponId,
  turningOn: boolean
): boolean {
  if (!turningOn) return true
  if (selectedIds.has(toggleId)) return true
  const next = new Set(selectedIds)
  next.add(toggleId)
  if (isCatRegistrationStackBlocked(next)) return false
  const raw = coupons
    .filter((c) => next.has(c.id))
    .reduce((s, c) => s + c.percent, 0)
  return raw <= MAX_COMBINED_COUPON_PERCENT + 1e-9
}

export function buildPromoCoupons(input: {
  catClaimed: boolean
  registrationClaimed: boolean
  loyaltyPercent?: number
  welcomeEligible?: boolean
  birthday?: { code: string; percent?: number; validUntil?: string } | null
  labels: {
    cat: string
    registration: string
    loyalty: string
    welcome: string
    birthday: string
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
  const loyaltyPct = (input.loyaltyPercent ?? 0) / 100
  if (loyaltyPct > 0) {
    out.push({
      id: 'loyalty',
      label: input.labels.loyalty,
      percent: loyaltyPct,
    })
  }
  if (input.birthday?.code) {
    const p =
      typeof input.birthday.percent === 'number' && input.birthday.percent > 0
        ? input.birthday.percent > 1
          ? input.birthday.percent / 100
          : input.birthday.percent
        : BIRTHDAY_COUPON_PERCENT
    out.push({
      id: 'birthday',
      label: input.labels.birthday,
      percent: p,
      code: input.birthday.code,
      hint: input.birthday.validUntil,
    })
  }
  return out
}
