/**
 * Vendég rákattint a cica pop-upra → regisztráció/belépés után
 * automatikusan igényelhető legyen a 5%-os macska kupon.
 */

export const CAT_COUPON_PENDING_KEY = 'gulumen-cat-coupon-pending'

const PENDING_TTL_MS = 30 * 60 * 1000

type PendingPayload = { at: number }

export function markCatCouponPending(): void {
  if (typeof window === 'undefined') return
  const payload: PendingPayload = { at: Date.now() }
  try {
    sessionStorage.setItem(CAT_COUPON_PENDING_KEY, JSON.stringify(payload))
  } catch {
    // private mode / quota
  }
}

export function hasCatCouponPending(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(CAT_COUPON_PENDING_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Partial<PendingPayload>
    if (typeof parsed.at !== 'number') {
      sessionStorage.removeItem(CAT_COUPON_PENDING_KEY)
      return false
    }
    if (Date.now() - parsed.at > PENDING_TTL_MS) {
      sessionStorage.removeItem(CAT_COUPON_PENDING_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

/** Olvasás + törlés. true, ha érvényes pending volt. */
export function consumeCatCouponPending(): boolean {
  if (typeof window === 'undefined') return false
  const ok = hasCatCouponPending()
  try {
    sessionStorage.removeItem(CAT_COUPON_PENDING_KEY)
  } catch {
    // ignore
  }
  return ok
}

export function clearCatCouponPending(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CAT_COUPON_PENDING_KEY)
  } catch {
    // ignore
  }
}
