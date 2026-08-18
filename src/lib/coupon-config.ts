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
 * Egy kupon legnagyobb beváltható kedvezménye (0–1).
 * A kuponok nem vonhatók össze; a checkouton egyszerre csak egy kupon érvényes.
 */
export const MAX_COMBINED_COUPON_PERCENT = 0.15

/** UI / admin: 15. */
export const MAX_COUPON_PERCENT_DISPLAY = Math.round(MAX_COMBINED_COUPON_PERCENT * 100)

/**
 * @deprecated A kuponok nem vonhatók össze. A konstans kompatibilitás miatt marad, mindig false.
 */
export const ALLOW_CAT_REGISTRATION_STACK = false

/** Kupon % plafonálása (pl. 0.25 → 0.15). */
export function capCombinedCouponPercent(totalPercent: number): number {
  if (!Number.isFinite(totalPercent) || totalPercent <= 0) return 0
  return Math.min(totalPercent, MAX_COMBINED_COUPON_PERCENT)
}

/** true, ha egynél több kupon van kijelölve (összevonás tilos). */
export function isCouponStackingBlocked(selectedIds: Iterable<string>): boolean {
  const set = selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  return set.size > 1
}

/** true, ha a macska + regisztrációs kupon együtt tilos a kijelölésben / checkouton. */
export function isCatRegistrationStackBlocked(
  selectedIds: Iterable<string>
): boolean {
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

export function getMaxCouponPercentDisplay(): number {
  return MAX_COUPON_PERCENT_DISPLAY
}
