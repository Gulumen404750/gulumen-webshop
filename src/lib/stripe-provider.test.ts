import { describe, expect, it } from 'vitest'
import { resolveStripeCheckoutPaymentMethod } from './stripe-provider'
import { stripeCheckoutMethodFields, stripePaymentMethodTypes } from './checkout-payment-methods'

describe('StripeProvider checkout mapping', () => {
  it('defaults to card wallets (Apple Pay / Google Pay Express Checkout)', () => {
    expect(resolveStripeCheckoutPaymentMethod()).toBe('card')
    expect(stripePaymentMethodTypes(resolveStripeCheckoutPaymentMethod())).toEqual(['card'])
    expect(stripeCheckoutMethodFields('card').payment_method_types).toBeUndefined()
  })

  it('maps PayPal and Klarna to their Stripe payment method types', () => {
    expect(stripePaymentMethodTypes(resolveStripeCheckoutPaymentMethod('paypal'))).toEqual(['paypal'])
    expect(stripePaymentMethodTypes(resolveStripeCheckoutPaymentMethod('klarna'))).toEqual(['klarna'])
    expect(stripePaymentMethodTypes(resolveStripeCheckoutPaymentMethod('apple_pay'))).toEqual(['card'])
    expect(stripePaymentMethodTypes(resolveStripeCheckoutPaymentMethod('google_pay'))).toEqual(['card'])
  })
})
