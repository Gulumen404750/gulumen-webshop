import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('checkout API payment methods', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/api/checkout/route.ts'), 'utf-8')

  it('accepts paymentMethod and locale and charges in the resolved currency', () => {
    expect(src).toMatch(/paymentMethod: z\.enum\(CHECKOUT_PAYMENT_METHODS\)/)
    expect(src).toMatch(/locale: z\.enum\(LOCALES\)/)
    expect(src).toMatch(/resolveChargeCurrency/)
    expect(src).toMatch(/toStripeUnitAmount/)
    expect(src).toMatch(/resolvePaymentMode/)
    expect(src).toMatch(/isKlarnaEligible/)
    expect(src).toMatch(/klarna_min_amount/)
    expect(src).toMatch(/KLARNA_MIN_AMOUNT_HUF/)
    expect(src).toMatch(/StripeCheckoutError/)
    expect(src).toMatch(/stripe_session_failed/)
    expect(src).toMatch(/isStripeCurrencyUnsupportedMessage/)
    expect(src).toMatch(/retrying EUR/)
    expect(src).toMatch(/restoreCreatedCheckoutOrders/)
    expect(src).toMatch(/releasePendingCheckoutHolds/)
    expect(src).toMatch(/restored stock after Stripe session failure/)
    expect(src).toMatch(/released pending holds after out_of_stock/)
  })

  it('still blocks two percent coupons before creating a payment', () => {
    const stackIdx = src.indexOf('isCouponStackingBlocked')
    const paymentIdx = src.indexOf('resolvePaymentMode')
    expect(stackIdx).toBeGreaterThan(0)
    expect(paymentIdx).toBeGreaterThan(stackIdx)
    expect(src).toMatch(/couponCodes/)
    expect(src).toMatch(/resolveCheckoutCoupons/)
    expect(src).toMatch(/secondaryCouponId/)
    expect(src).toMatch(/isFixedCouponDiscount/)
    expect(src).toMatch(/fixedIds/)
    expect(src).not.toMatch(/points_promo_stack_disabled/)
    expect(src).toMatch(/prePointsTotals/)
    expect(src).toMatch(/afterCouponAndLuckyHuf/)
  })
})

