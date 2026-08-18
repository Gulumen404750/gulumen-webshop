import { describe, expect, it } from 'vitest'
import { FALLBACK_HUF_PER_EUR } from '@/lib/euro-rate'
import {
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  forcesImmediateCapture,
  isCheckoutPaymentMethod,
  isExpressWalletMethod,
  isInstallmentPayment,
  resolveChargeCurrency,
  resolvePaymentMode,
  stripeCheckoutAmountMatches,
  stripePaymentMethodTypes,
  toStripeUnitAmount,
} from '@/lib/checkout-payment-methods'

describe('checkout payment methods', () => {
  it('accepts the supported checkout methods', () => {
    expect(isCheckoutPaymentMethod('card')).toBe(true)
    expect(isCheckoutPaymentMethod('paypal')).toBe(true)
    expect(isCheckoutPaymentMethod('apple_pay')).toBe(true)
    expect(isCheckoutPaymentMethod('google_pay')).toBe(true)
    expect(isCheckoutPaymentMethod('klarna')).toBe(true)
    expect(isCheckoutPaymentMethod('bitcoin')).toBe(false)
    expect(DEFAULT_CHECKOUT_PAYMENT_METHOD).toBe('card')
  })

  it('charges HUF for Hungarian PayPal/card/wallets and EUR otherwise', () => {
    expect(resolveChargeCurrency('paypal', 'hu')).toBe('huf')
    expect(resolveChargeCurrency('card', 'hu')).toBe('huf')
    expect(resolveChargeCurrency('apple_pay', 'hu')).toBe('huf')
    expect(resolveChargeCurrency('google_pay', 'en')).toBe('eur')
    expect(resolveChargeCurrency('paypal', 'de')).toBe('eur')
    expect(resolveChargeCurrency('card', 'ro')).toBe('eur')
  })

  it('always charges Klarna in EUR (Stripe Klarna has no HUF)', () => {
    expect(resolveChargeCurrency('klarna', 'hu')).toBe('eur')
    expect(resolveChargeCurrency('klarna', 'en')).toBe('eur')
  })

  it('converts HUF totals to Stripe zero-decimal HUF and EUR cents', () => {
    expect(toStripeUnitAmount(12_345, 'huf', FALLBACK_HUF_PER_EUR)).toBe(12_345)
    expect(toStripeUnitAmount(3950, 'eur', FALLBACK_HUF_PER_EUR)).toBe(1000)
  })

  it('maps wallets to card (Express Checkout) and PayPal/Klarna to their types', () => {
    expect(stripePaymentMethodTypes('card')).toEqual(['card'])
    expect(stripePaymentMethodTypes('apple_pay')).toEqual(['card'])
    expect(stripePaymentMethodTypes('google_pay')).toEqual(['card'])
    expect(stripePaymentMethodTypes('paypal')).toEqual(['paypal'])
    expect(stripePaymentMethodTypes('klarna')).toEqual(['klarna'])
    expect(isExpressWalletMethod('apple_pay')).toBe(true)
    expect(isExpressWalletMethod('paypal')).toBe(false)
  })

  it('captures Klarna immediately even for sourcing so the order is fully paid', () => {
    expect(forcesImmediateCapture('klarna')).toBe(true)
    expect(forcesImmediateCapture('paypal')).toBe(false)
    expect(resolvePaymentMode('sourcing', 'klarna')).toBe('capture')
    expect(resolvePaymentMode('sourcing', 'card')).toBe('authorize')
    expect(resolvePaymentMode('in_stock', 'paypal')).toBe('capture')
  })

  it('does not earn purchase points on installment (Klarna)', () => {
    expect(isInstallmentPayment('klarna')).toBe(true)
    expect(isInstallmentPayment('card')).toBe(false)
    expect(isInstallmentPayment('paypal')).toBe(false)
    expect(isInstallmentPayment(undefined)).toBe(false)
  })

  it('matches Stripe webhook amounts against the stored charge currency', () => {
    expect(
      stripeCheckoutAmountMatches({
        amountTotal: 1000,
        currency: 'eur',
        expectedAmount: 1000,
        expectedCurrency: 'eur',
      })
    ).toBe(true)
    expect(
      stripeCheckoutAmountMatches({
        amountTotal: 12_345,
        currency: 'HUF',
        expectedAmount: 12_345,
        expectedCurrency: 'huf',
      })
    ).toBe(true)
    expect(
      stripeCheckoutAmountMatches({
        amountTotal: 1000,
        currency: 'eur',
        expectedAmount: 12_345,
        expectedCurrency: 'huf',
      })
    ).toBe(false)
  })
})
