import { describe, expect, it } from 'vitest'
import { canElevateOrderFromProof, type StripePaymentProof } from './stripe-payment-proof'

function proof(partial: Partial<StripePaymentProof>): StripePaymentProof {
  return {
    paid: false,
    authorized: false,
    ...partial,
  }
}

describe('canElevateOrderFromProof', () => {
  it('allows elevation when payment_status paid', () => {
    expect(canElevateOrderFromProof(proof({ paid: true }))).toBe(true)
  })

  it('allows elevation when authorize requires_capture / succeeded', () => {
    expect(canElevateOrderFromProof(proof({ authorized: true }))).toBe(true)
  })

  it('denies elevation without payment proof', () => {
    expect(canElevateOrderFromProof(proof({}))).toBe(false)
  })
})
