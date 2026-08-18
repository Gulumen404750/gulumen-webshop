import { describe, expect, it } from 'vitest'
import {
  isCouponStackingBlocked,
  isFixedCouponDiscount,
  exclusiveCouponIds,
} from '@/lib/coupon-config'

describe('fixed coupon stacking rules', () => {
  it('still blocks two percentage coupons', () => {
    expect(isCouponStackingBlocked(['cat', 'registration'])).toBe(true)
    expect(isCouponStackingBlocked(['welcome', 'birthday'])).toBe(true)
  })

  it('allows a fixed coupon beside one percentage coupon', () => {
    expect(
      isCouponStackingBlocked(['cat', 'gamification'], { fixedIds: ['gamification'] })
    ).toBe(false)
    expect(
      isCouponStackingBlocked(['welcome', 'gamification'], { fixedIds: ['gamification'] })
    ).toBe(false)
  })

  it('still blocks two percentage coupons even if a fixed id is present', () => {
    expect(
      isCouponStackingBlocked(['cat', 'welcome', 'gamification'], { fixedIds: ['gamification'] })
    ).toBe(true)
  })

  it('does not treat loyalty as an exclusive coupon', () => {
    expect(exclusiveCouponIds(['loyalty', 'cat'])).toEqual(new Set(['cat']))
    expect(isCouponStackingBlocked(['loyalty', 'cat'])).toBe(false)
  })

  it('detects fixed HUF discounts', () => {
    expect(isFixedCouponDiscount({ fixedHuf: 15_000 })).toBe(true)
    expect(isFixedCouponDiscount({ percent: 0.1 })).toBe(false)
    expect(isFixedCouponDiscount({ percent: 0.1, fixedHuf: 0 })).toBe(false)
  })
})
