import { describe, expect, it } from 'vitest'
import {
  checkoutCustomerSchema,
  toOrderCustomerSnapshot,
} from './checkout-customer'

const validCustomer = {
  email: 'Buyer@Example.com',
  name: 'Kiss Anna',
  phone: '+36 30 123 4567',
  shipping: {
    postalCode: '1051',
    city: 'Budapest',
    street: 'Váci utca',
    houseNumber: '1',
  },
  billingSameAsShipping: true,
}

describe('checkoutCustomerSchema', () => {
  it('accepts a complete shipping payload', () => {
    const parsed = checkoutCustomerSchema.parse(validCustomer)
    expect(parsed.name).toBe('Kiss Anna')
    expect(parsed.billingSameAsShipping).toBe(true)
  })

  it('requires billing when billingSameAsShipping is false', () => {
    const result = checkoutCustomerSchema.safeParse({
      ...validCustomer,
      billingSameAsShipping: false,
    })
    expect(result.success).toBe(false)
  })

  it('accepts separate billing address', () => {
    const parsed = checkoutCustomerSchema.parse({
      ...validCustomer,
      billingSameAsShipping: false,
      billing: {
        postalCode: '1111',
        city: 'Budapest',
        street: 'Bartók Béla út',
        houseNumber: '10/A',
      },
    })
    expect(parsed.billing?.city).toBe('Budapest')
  })

  it('rejects invalid phone', () => {
    const result = checkoutCustomerSchema.safeParse({
      ...validCustomer,
      phone: 'abc',
    })
    expect(result.success).toBe(false)
  })
})

describe('toOrderCustomerSnapshot', () => {
  it('normalizes email and copies shipping when billing same', () => {
    const snap = toOrderCustomerSnapshot(checkoutCustomerSchema.parse(validCustomer))
    expect(snap.email).toBe('buyer@example.com')
    expect(snap.billingSameAsShipping).toBe(true)
    expect(snap.billingCity).toBeNull()
    expect(snap.shippingCity).toBe('Budapest')
  })

  it('stores separate billing fields', () => {
    const snap = toOrderCustomerSnapshot(
      checkoutCustomerSchema.parse({
        ...validCustomer,
        billingSameAsShipping: false,
        billing: {
          postalCode: '2000',
          city: 'Szentendre',
          street: 'Fő tér',
          houseNumber: '3',
        },
      })
    )
    expect(snap.billingSameAsShipping).toBe(false)
    expect(snap.billingCity).toBe('Szentendre')
    expect(snap.billingHouseNumber).toBe('3')
  })
})
