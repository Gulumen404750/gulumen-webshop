import { describe, expect, it } from 'vitest'
import {
  buildPromoCoupons,
  calculateSelectedCouponPercent,
  canToggleCoupon,
  MAX_COMBINED_COUPON_PERCENT,
} from '@/lib/coupon-selection'

const labels = {
  cat: 'Macska 5%',
  registration: 'Regisztráció 10%',
  loyalty: 'Hűség',
  welcome: 'Welcome 10%',
  birthday: 'Születésnap 15%',
}

describe('coupon selection + 20% cap', () => {
  const coupons = buildPromoCoupons({
    catClaimed: true,
    registrationClaimed: true,
    loyaltyPercent: 5,
    welcomeEligible: true,
    birthday: { code: 'BDAY15', percent: 15 },
    labels,
  })

  it('lists available coupons', () => {
    expect(coupons.map((c) => c.id).sort()).toEqual(
      ['birthday', 'cat', 'loyalty', 'registration', 'welcome'].sort()
    )
  })

  it('allows cat + registration (15%)', () => {
    const result = calculateSelectedCouponPercent(coupons, ['cat', 'registration'])
    expect(result.finalPercent).toBeCloseTo(0.15)
    expect(result.capped).toBe(false)
  })

  it('caps birthday + registration (25% → 20%)', () => {
    const result = calculateSelectedCouponPercent(coupons, ['birthday', 'registration'])
    expect(result.rawPercent).toBeCloseTo(0.25)
    expect(result.finalPercent).toBeCloseTo(MAX_COMBINED_COUPON_PERCENT)
    expect(result.capped).toBe(true)
  })

  it('blocks toggle that would exceed 20%', () => {
    const selected = new Set(['birthday', 'registration'] as const)
    // already over if both selected via calculate; toggle adding cat to birthday+reg
    const withBirthday = new Set(['birthday'] as const)
    expect(canToggleCoupon(coupons, withBirthday, 'cat', true)).toBe(true) // 20%
    expect(canToggleCoupon(coupons, withBirthday, 'registration', true)).toBe(false) // 25%
    expect(canToggleCoupon(coupons, selected, 'cat', false)).toBe(true) // deselect always ok
  })
})
