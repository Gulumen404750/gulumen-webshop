const STORAGE_KEY = 'gulumen.typedCouponCode'

export type StoredTypedCoupon = {
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderHuf: number | null
}

export function readTypedCoupon(): StoredTypedCoupon | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredTypedCoupon
    if (!parsed?.code || (parsed.discountType !== 'percent' && parsed.discountType !== 'fixed')) {
      return null
    }
    if (!Number.isFinite(parsed.discountValue) || parsed.discountValue < 1) return null
    return {
      code: String(parsed.code).trim().toUpperCase(),
      discountType: parsed.discountType,
      discountValue: Math.floor(parsed.discountValue),
      minOrderHuf: parsed.minOrderHuf == null ? null : Math.floor(parsed.minOrderHuf),
    }
  } catch {
    return null
  }
}

export function writeTypedCoupon(coupon: StoredTypedCoupon | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!coupon) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(coupon))
  } catch {
    /* ignore quota / private mode */
  }
}
