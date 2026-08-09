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

  it('accepts optional delivery notes and address type', () => {
    const parsed = checkoutCustomerSchema.parse({
      ...validCustomer,
      deliveryNotes: '  Kapukód: 1234, 3. emelet  ',
      addressType: 'business',
    })
    expect(parsed.deliveryNotes).toBe('Kapukód: 1234, 3. emelet')
    expect(parsed.addressType).toBe('business')
  })

  it('defaults addressType to home and omits empty notes', () => {
    const parsed = checkoutCustomerSchema.parse({
      ...validCustomer,
      deliveryNotes: '   ',
    })
    expect(parsed.addressType).toBe('home')
    expect(parsed.deliveryNotes).toBeUndefined()
  })

  it('rejects delivery notes over 500 chars', () => {
    const result = checkoutCustomerSchema.safeParse({
      ...validCustomer,
      deliveryNotes: 'x'.repeat(501),
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
    expect(snap.deliveryNotes).toBeNull()
    expect(snap.addressType).toBe('home')
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

  it('persists courier notes and address type', () => {
    const snap = toOrderCustomerSnapshot(
      checkoutCustomerSchema.parse({
        ...validCustomer,
        deliveryNotes: 'Csengő: Kovács',
        addressType: 'business',
      })
    )
    expect(snap.deliveryNotes).toBe('Csengő: Kovács')
    expect(snap.addressType).toBe('business')
  })
})
