import { describe, expect, it } from 'vitest'
import {
  isLifetimeSavingsStatus,
  savingsHufFromOrder,
  sumLifetimeSavingsHuf,
} from './lifetime-savings'

describe('lifetime savings', () => {
  it('adds coupon/loyalty discount and points on paid-like orders', () => {
    expect(savingsHufFromOrder({ discountHuf: 990, pointsDiscountHuf: 2_000 })).toBe(2_990)
    expect(
      sumLifetimeSavingsHuf([
        { status: 'paid', discountHuf: 1_000, pointsDiscountHuf: 500 },
        { status: 'fulfilled', discountHuf: 200, pointsDiscountHuf: 0 },
        { status: 'pending', discountHuf: 9_999, pointsDiscountHuf: 9_999 },
        { status: 'cancelled', discountHuf: 400, pointsDiscountHuf: 100 },
      ])
    ).toBe(1_700)
  })

  it('ignores non-paid statuses and negative leftovers', () => {
    expect(isLifetimeSavingsStatus('paid')).toBe(true)
    expect(isLifetimeSavingsStatus('sourcing_pending')).toBe(true)
    expect(isLifetimeSavingsStatus('failed')).toBe(false)
    expect(savingsHufFromOrder({ discountHuf: -10, pointsDiscountHuf: null })).toBe(0)
  })
})
