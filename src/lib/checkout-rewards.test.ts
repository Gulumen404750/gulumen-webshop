import { describe, expect, it } from 'vitest'
import { parseAppliedCoupons } from '@/lib/checkout-rewards'

describe('parseAppliedCoupons', () => {
  it('parses known coupon kinds', () => {
    expect(parseAppliedCoupons(['cat', 'birthday', 'welcome', 'loyalty', 'registration'])).toEqual([
      'cat',
      'birthday',
      'welcome',
      'loyalty',
      'registration',
    ])
  })

  it('filters unknown / invalid values', () => {
    expect(parseAppliedCoupons(['cat', 'nope', 12, null, 'birthday'])).toEqual(['cat', 'birthday'])
  })

  it('returns empty for non-arrays', () => {
    expect(parseAppliedCoupons(null)).toEqual([])
    expect(parseAppliedCoupons({ cat: true })).toEqual([])
  })
})
