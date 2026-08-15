/** Macska-játék egyszeri kupon (0–1). */
export const CAT_COUPON_PERCENT = 0.05

/** Regisztrációs egyszeri kupon az első vásárlásra (0–1). */
export const REGISTRATION_COUPON_PERCENT = 0.1

/**
 * Checkout welcome ajánlat: hírlevél feliratkozás → azonnali 10%.
 * Ugyanaz a mérték, mint a regisztrációs kupon; külön flaggel (hasRedeemedWelcomeCoupon) védve.
 */
export const WELCOME_CHECKOUT_COUPON_PERCENT = 0.1

/** Születésnapi exkluzív kupon (0–1). */
export const BIRTHDAY_COUPON_PERCENT = 0.15

/** Születésnapi kupon érvényesség napokban a kiküldéstől. */
export const BIRTHDAY_COUPON_VALID_DAYS = 7

/**
 * Manuálisan kiválasztott kuponok összesített kedvezményének plafonja (0–1).
 * Több kupon kombinálható, de az eredmény legfeljebb ennyi lehet.
 */
export const MAX_COMBINED_COUPON_PERCENT = 0.2

/**
 * Kezdeti időszak: a macska 5% + regisztrációs 10% együtt is igényelhető / alkalmazható
 * (összesen 15%, a MAX_COMBINED_COUPON_PERCENT plafonig).
 *
 * Később kikapcsolható:
 * - kódban: állítsd false-ra, VAGY
 * - env: ALLOW_CAT_REGISTRATION_STACK=0 / NEXT_PUBLIC_ALLOW_CAT_REGISTRATION_STACK=0
 *
 * Kikapcsolva: mindkettő igényelhető marad, de a checkouton egyszerre csak az egyik
 * választható (nem halmozódnak).
 */
const STACK_ENV =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_ALLOW_CAT_REGISTRATION_STACK ??
      process.env.ALLOW_CAT_REGISTRATION_STACK
    : undefined

export const ALLOW_CAT_REGISTRATION_STACK: boolean =
  STACK_ENV === undefined || STACK_ENV === ''
    ? true
    : !['0', 'false', 'no', 'off'].includes(STACK_ENV.trim().toLowerCase())

/** Összesített kupon % plafonálása (pl. 0.25 → 0.20). */
export function capCombinedCouponPercent(totalPercent: number): number {
  if (!Number.isFinite(totalPercent) || totalPercent <= 0) return 0
  return Math.min(totalPercent, MAX_COMBINED_COUPON_PERCENT)
}

/** true, ha a macska + regisztrációs kupon együtt tilos a kijelölésben / checkouton. */
export function isCatRegistrationStackBlocked(
  selectedIds: Iterable<string>
): boolean {
  if (ALLOW_CAT_REGISTRATION_STACK) return false
  const set = selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  return set.has('cat') && set.has('registration')
}

/** Kijelzéshez: 5, 10, 15 … Ha nincs regisztrációs kupon, 0. */
export function getRegistrationCouponPercentDisplay(): number {
  if (REGISTRATION_COUPON_PERCENT <= 0) return 0
  return Math.round(REGISTRATION_COUPON_PERCENT * 100)
}

export function getWelcomeCheckoutCouponPercentDisplay(): number {
  if (WELCOME_CHECKOUT_COUPON_PERCENT <= 0) return 0
  return Math.round(WELCOME_CHECKOUT_COUPON_PERCENT * 100)
}

export function getBirthdayCouponPercentDisplay(): number {
  if (BIRTHDAY_COUPON_PERCENT <= 0) return 0
  return Math.round(BIRTHDAY_COUPON_PERCENT * 100)
}
