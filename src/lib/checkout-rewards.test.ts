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

describe('success-page finalize eligibility', () => {
  const actionable = (status: string) =>
    ['paid', 'fulfilled', 'sourcing_pending', 'payment_pending'].includes(status)

  it('treats payment_pending as actionable for order_group_id success path', () => {
    expect(actionable('payment_pending')).toBe(true)
    expect(actionable('paid')).toBe(true)
    expect(actionable('cancelled')).toBe(false)
  })
})
