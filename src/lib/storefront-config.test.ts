import { describe, expect, it } from 'vitest'
import { isSaleActive, getSaleDiscountPercent } from './storefront-config'
import type { Product } from '@/lib/data'

function product(partial: Partial<Product> & Pick<Product, 'id' | 'priceHuf'>): Product {
  return {
    name: partial.id,
    slug: partial.id,
    type: 'stock',
    active: true,
    onSale: false,
    ...partial,
  } as Product
}

describe('isSaleActive (checkout sale-window pricing)', () => {
  const now = new Date('2026-08-09T12:00:00.000Z')

  it('is false when product is not onSale', () => {
    expect(
      isSaleActive(
        product({ id: 'a', priceHuf: 1000, discountPriceHuf: 800, onSale: false }),
        now
      )
    ).toBe(false)
  })

  it('is false when discountPriceHuf is missing', () => {
    expect(
      isSaleActive(product({ id: 'a', priceHuf: 1000, onSale: true }), now)
    ).toBe(false)
  })

  it('is true inside an open sale window', () => {
    expect(
      isSaleActive(
        product({
          id: 'a',
          priceHuf: 10_000,
          discountPriceHuf: 7_000,
          onSale: true,
          saleStartAt: '2026-01-01T00:00:00.000Z',
          saleEndAt: '2026-12-31T00:00:00.000Z',
        }),
        now
      )
    ).toBe(true)
  })

  it('is false before saleStartAt (not yet started)', () => {
    expect(
      isSaleActive(
        product({
          id: 'a',
          priceHuf: 10_000,
          discountPriceHuf: 7_000,
          onSale: true,
          saleStartAt: '2026-09-01T00:00:00.000Z',
          saleEndAt: '2026-12-31T00:00:00.000Z',
        }),
        now
      )
    ).toBe(false)
  })

  it('is false after saleEndAt (expired – prevents undercharge)', () => {
    expect(
      isSaleActive(
        product({
          id: 'a',
          priceHuf: 10_000,
          discountPriceHuf: 7_000,
          onSale: true,
          saleStartAt: '2026-01-01T00:00:00.000Z',
          saleEndAt: '2026-07-01T00:00:00.000Z',
        }),
        now
      )
    ).toBe(false)
  })

  it('treats missing start/end as always-active when onSale + discount set', () => {
    expect(
      isSaleActive(
        product({
          id: 'a',
          priceHuf: 10_000,
          discountPriceHuf: 7_000,
          onSale: true,
        }),
        now
      )
    ).toBe(true)
  })
})

describe('getSaleDiscountPercent', () => {
  it('returns rounded percent off', () => {
    expect(
      getSaleDiscountPercent(
        product({ id: 'a', priceHuf: 10_000, discountPriceHuf: 7_000 })
      )
    ).toBe(30)
  })

  it('returns null without discount price', () => {
    expect(getSaleDiscountPercent(product({ id: 'a', priceHuf: 10_000 }))).toBeNull()
  })
})
