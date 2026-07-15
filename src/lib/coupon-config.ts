/** Macska-játék egyszeri kupon (0–1). */
export const CAT_COUPON_PERCENT = 0.05

/** Regisztrációs egyszeri kupon az első vásárlásra (0–1). */
export const REGISTRATION_COUPON_PERCENT = 0.1

/** Kijelzéshez: 5, 10, 15 … Ha nincs regisztrációs kupon, 0. */
export function getRegistrationCouponPercentDisplay(): number {
  if (REGISTRATION_COUPON_PERCENT <= 0) return 0
  return Math.round(REGISTRATION_COUPON_PERCENT * 100)
}
