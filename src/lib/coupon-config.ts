import { MAX_LOYALTY_COUPON_PERCENT } from '@/lib/loyalty-constants'

/** Macska-játék egyszeri kupon (0–1). */
export const CAT_COUPON_PERCENT = 0.05

/** Regisztrációs egyszeri kupon az első vásárlásra (0–1). */
export const REGISTRATION_COUPON_PERCENT = 0.1

/** Éles deploy marker – Railway Watch Paths a src/** fájlokra figyel. */
export const COUPON_STACKING_DEPLOY_MARKER = '2026-08-20T20:18'

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
 * Egy százalékos kupon legnagyobb beváltható kedvezménye (0–1).
 * A százalékos kuponok egymással nem vonhatók össze; a checkouton egyszerre egy % kupon érvényes.
 * A fix forintos kupon (ajándék / admin) összevonható egy százalékos kuponnal:
 * (kosár - fix) * (1 - százalék). A hűség (1–5%) automatikus alapkedvezmény.
 * Pontfizetés és Szerencsekerék a kupon extra mellett nem érvényesül.
 */
export const MAX_COMBINED_COUPON_PERCENT = 0.15

/** Hűségkedvezmény plafon (0–1). Nem számít bele a 15%-os kuponplafonba. */
export { MAX_LOYALTY_COUPON_PERCENT }

/** UI / admin: 15. */
export const MAX_COUPON_PERCENT_DISPLAY = Math.round(MAX_COMBINED_COUPON_PERCENT * 100)

/**
 * @deprecated A kuponok nem vonhatók össze. A konstans kompatibilitás miatt marad, mindig false.
 */
export const ALLOW_CAT_REGISTRATION_STACK = false

/** Kupon % plafonálása (pl. 0.25 → 0.15). A hűséget nem plafonálja. */
export function capCombinedCouponPercent(totalPercent: number): number {
  if (!Number.isFinite(totalPercent) || totalPercent <= 0) return 0
  return Math.min(totalPercent, MAX_COMBINED_COUPON_PERCENT)
}

export function capLoyaltyPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0
  // DB / UI: 1–5 egész %; számolás: 0–0.05 tört.
  const fraction = percent >= 1 ? percent / 100 : percent
  return Math.min(fraction, MAX_LOYALTY_COUPON_PERCENT)
}

/** Kizárólagos (nem hűség) kuponok – a százalékos kuponok egymással nem vonhatók össze. */
export function exclusiveCouponIds(selectedIds: Iterable<string>): Set<string> {
  const exclusive = new Set<string>()
  for (const id of selectedIds) {
    if (id && id !== 'loyalty') exclusive.add(id)
  }
  return exclusive
}

export type CouponStackingOptions = {
  /** Ezek az azonosítók fix Ft kuponok – egy százalékos kuponnal összevonhatók. */
  fixedIds?: Iterable<string>
}

/** true, ha egynél több százalékos (nem fix Ft) kupon van kijelölve. */
export function isCouponStackingBlocked(
  selectedIds: Iterable<string>,
  options?: CouponStackingOptions
): boolean {
  const exclusive = exclusiveCouponIds(selectedIds)
  if (options?.fixedIds) {
    for (const id of options.fixedIds) exclusive.delete(id)
  }
  return exclusive.size > 1
}

/** true, ha a kedvezmény fix forintos (ajándék / admin) kupon. */
export function isFixedCouponDiscount(discount: { fixedHuf?: number; percent?: number }): boolean {
  return Boolean(discount.fixedHuf && discount.fixedHuf > 0)
}

/** Van-e hűségen felüli kupon extra (százalékos vagy fix Ft). */
export function hasCouponExtraDiscount(discount: { percent?: number; fixedHuf?: number }): boolean {
  return (Number(discount.percent) || 0) > 0 || (Number(discount.fixedHuf) || 0) > 0
}

/** Kupon extra és pontfizetés egymást kizárja; a hűség mindig külön. */
export function isCouponPointsStackBlocked(
  hasCouponExtra: boolean,
  usePoints: boolean
): boolean {
  return hasCouponExtra && usePoints
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
