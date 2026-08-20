import { describe, expect, it } from 'vitest'
import { checkoutErrorI18nKey, resolveCheckoutErrorMessage } from './checkout-client-errors'

describe('checkoutErrorI18nKey', () => {
  it('maps coupon and stock codes instead of the generic session error', () => {
    expect(checkoutErrorI18nKey('coupon_min_order', 400)).toBe('payment.couponMinOrder')
    expect(checkoutErrorI18nKey('coupon_stack_disabled', 400)).toBe(
      'payment.couponCatRegStackBlocked'
    )
    expect(checkoutErrorI18nKey('points_promo_stack_disabled', 400)).toBe(
      'payment.pointsPromoStackDisabled'
    )
    expect(checkoutErrorI18nKey('out_of_stock', 409)).toBe('payment.errorOutOfStock')
    expect(checkoutErrorI18nKey(undefined, 429)).toBe('payment.errorRateLimited')
    expect(checkoutErrorI18nKey(undefined, 500)).toBe('payment.errorCreateSession')
  })
})

describe('resolveCheckoutErrorMessage', () => {
  it('interpolates min-order amount in the shop currency', () => {
    const text = resolveCheckoutErrorMessage({
      t: (key, vars) => `${key}:${vars?.amount ?? ''}`,
      money: (huf) => `€${(huf / 395).toFixed(2)}`,
      status: 400,
      code: 'coupon_min_order',
      minOrderHuf: 3950,
    })
    expect(text).toBe('payment.couponMinOrder:€10.00')
    expect(text).not.toMatch(/HUF/)
  })
})
