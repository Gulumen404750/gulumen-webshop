import { describe, expect, it } from 'vitest'
import {
  canCustomerEditShippingAddress,
  hasShippingAddressChanged,
  shippingFieldsEqual,
} from './order-shipping-edit'

describe('order-shipping-edit', () => {
  it('allows edit for paid unprinted orders', () => {
    expect(canCustomerEditShippingAddress({ status: 'paid', printedAt: null })).toEqual({
      ok: true,
    })
    expect(
      canCustomerEditShippingAddress({ status: 'sourcing_pending', printedAt: undefined })
    ).toEqual({ ok: true })
  })

  it('blocks edit after print or fulfillment', () => {
    expect(
      canCustomerEditShippingAddress({ status: 'paid', printedAt: '2026-08-15T12:00:00.000Z' })
    ).toEqual({ ok: false, reason: 'already_printed' })
    expect(canCustomerEditShippingAddress({ status: 'fulfilled', printedAt: null })).toEqual({
      ok: false,
      reason: 'order_closed',
    })
    expect(canCustomerEditShippingAddress({ status: 'cancelled', printedAt: null })).toEqual({
      ok: false,
      reason: 'order_closed',
    })
    expect(canCustomerEditShippingAddress({ status: 'payment_pending', printedAt: null })).toEqual({
      ok: false,
      reason: 'status_locked',
    })
  })

  it('detects address change flag', () => {
    expect(hasShippingAddressChanged(null)).toBe(false)
    expect(hasShippingAddressChanged('2026-08-15T12:00:00.000Z')).toBe(true)
  })

  it('compares shipping fields', () => {
    expect(
      shippingFieldsEqual(
        {
          customerName: 'A',
          shippingPostalCode: '1051',
          shippingCity: 'Budapest',
          shippingStreet: 'Váci',
          shippingHouseNumber: '1',
        },
        {
          customerName: 'A',
          shippingPostalCode: '1051',
          shippingCity: 'Budapest',
          shippingStreet: 'Váci',
          shippingHouseNumber: '1',
        }
      )
    ).toBe(true)
    expect(
      shippingFieldsEqual(
        { shippingPostalCode: '1051', shippingCity: 'Budapest', shippingStreet: 'A', shippingHouseNumber: '1' },
        { shippingPostalCode: '1051', shippingCity: 'Budapest', shippingStreet: 'B', shippingHouseNumber: '1' }
      )
    ).toBe(false)
  })
})
