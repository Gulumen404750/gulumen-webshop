import { describe, expect, it } from 'vitest'
import {
  computeCheckoutTotals,
  computeCouponDiscountHuf,
  computePointsRedemption,
  computeShippingHuf,
  calculateDiscount,
  resolveCartLines,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE_HUF,
  type ResolvedCartLine,
} from './checkout'
import type { Product } from '@/lib/data'
import { computeLuckySpinDiscount } from './gamification/lucky-spin'

function line(
  productId: string,
  qty: number,
  priceHuf: number,
  fulfillmentType: 'stock' | 'procurement' = 'stock'
): ResolvedCartLine {
  return { productId, qty, priceHuf, fulfillmentType, name: productId }
}

describe('calculateDiscount', () => {
  it('returns tiered discount by item count', () => {
    expect(calculateDiscount(0)).toBe(0)
    expect(calculateDiscount(1)).toBe(0.15)
    expect(calculateDiscount(4)).toBe(0.15)
    expect(calculateDiscount(5)).toBe(0.2)
    expect(calculateDiscount(9)).toBe(0.2)
    expect(calculateDiscount(10)).toBe(0.25)
    expect(calculateDiscount(15)).toBe(0.25)
  })

  it('adds +5% when paying with points', () => {
    expect(calculateDiscount(4, true)).toBe(0.2)
    expect(calculateDiscount(5, true)).toBe(0.25)
    expect(calculateDiscount(10, true)).toBe(0.3)
  })
})

describe('computeLuckySpinDiscount', () => {
  const spin = {
    id: 'spin-1',
    userId: 'u1',
    weekId: '2026-W01',
    productIds: ['a', 'b'],
    priceSnapshot: { a: 1000, b: 2000 },
    generatedAt: new Date('2026-01-01'),
    expiresAt: new Date('2099-01-01'),
  }

  it('applies 15% from first qualifying item', () => {
    const result = computeLuckySpinDiscount(
      [{ productId: 'a', qty: 2, priceHuf: 1000 }],
      spin
    )
    expect(result.active).toBe(true)
    expect(result.discountPercent).toBe(0.15)
    expect(result.discountHuf).toBe(300)
  })

  it('stacks +5% with points at 10+ items', () => {
    const result = computeLuckySpinDiscount(
      [{ productId: 'a', qty: 10, priceHuf: 1000 }],
      spin,
      new Date('2026-01-02'),
      true
    )
    expect(result.discountPercent).toBe(0.3)
    expect(result.discountHuf).toBe(3000)
  })
})

describe('computeCouponDiscountHuf', () => {
  it('applies percent only to non-spin items', () => {
    const lines = [
      line('full-a', 1, 10_000),
      line('spin-b', 1, 5_000),
    ]
    const spinIds = new Set(['spin-b'])
    expect(computeCouponDiscountHuf(lines, { percent: 0.1 }, spinIds)).toBe(1_000)
  })

  it('caps coupon at full-price subtotal', () => {
    const lines = [line('a', 1, 500)]
    expect(computeCouponDiscountHuf(lines, { percent: 0.5, fixedHuf: 400 })).toBe(500)
  })
})

describe('computePointsRedemption', () => {
  it('limits discount to 30% of order total', () => {
    const result = computePointsRedemption(10_000, {
      requestedDiscountHuf: 5_000,
      userBalance: 50_000,
    })
    expect(result.pointsDiscountHuf).toBe(3_000)
    expect(result.pointsUsed).toBe(12_000)
  })

  it('rejects redemption when balance is insufficient', () => {
    const result = computePointsRedemption(10_000, {
      requestedDiscountHuf: 1_000,
      userBalance: 100,
    })
    expect(result).toEqual({ pointsDiscountHuf: 0, pointsUsed: 0 })
  })
})

describe('computeShippingHuf', () => {
  it('charges standard fee below free-shipping threshold', () => {
    expect(computeShippingHuf(FREE_SHIPPING_THRESHOLD - 1)).toBe(STANDARD_SHIPPING_FEE_HUF)
  })

  it('is free at or above threshold', () => {
    expect(computeShippingHuf(FREE_SHIPPING_THRESHOLD)).toBe(0)
    expect(computeShippingHuf(FREE_SHIPPING_THRESHOLD + 1)).toBe(0)
  })
})

describe('resolveCartLines', () => {
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

  it('uses discountPriceHuf only while sale window is active', () => {
    const map = new Map<string, Product>([
      [
        'sale-on',
        product({
          id: 'sale-on',
          priceHuf: 10_000,
          discountPriceHuf: 7_000,
          onSale: true,
          saleStartAt: '2020-01-01T00:00:00.000Z',
          saleEndAt: '2099-01-01T00:00:00.000Z',
        }),
      ],
      [
        'sale-off',
        product({
          id: 'sale-off',
          priceHuf: 10_000,
          discountPriceHuf: 7_000,
          onSale: true,
          saleStartAt: '2020-01-01T00:00:00.000Z',
          saleEndAt: '2020-06-01T00:00:00.000Z',
        }),
      ],
    ])

    const lines = resolveCartLines(
      [
        { productId: 'sale-on', qty: 1 },
        { productId: 'sale-off', qty: 2 },
      ],
      map
    )

    expect(lines).toEqual([
      expect.objectContaining({ productId: 'sale-on', priceHuf: 7_000 }),
      expect.objectContaining({ productId: 'sale-off', priceHuf: 10_000, qty: 2 }),
    ])
  })

  it('does not undercharge when sale has not started yet', () => {
    const map = new Map<string, Product>([
      [
        'future-sale',
        product({
          id: 'future-sale',
          priceHuf: 12_000,
          discountPriceHuf: 6_000,
          onSale: true,
          saleStartAt: '2099-01-01T00:00:00.000Z',
          saleEndAt: '2099-12-31T00:00:00.000Z',
        }),
      ],
    ])

    const lines = resolveCartLines([{ productId: 'future-sale', qty: 1 }], map)
    expect(lines[0]?.priceHuf).toBe(12_000)
  })
})

describe('computeCheckoutTotals', () => {
  it('splits stock and procurement lines with proportional discounts', () => {
    const lines = [
      line('stock-1', 2, 5_000, 'stock'),
      line('source-1', 1, 10_000, 'procurement'),
    ]

    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0.1 },
      luckySpin: null,
      points: { requestedDiscountHuf: 1_500, userBalance: 100_000 },
    })

    expect(totals.subtotalHuf).toBe(20_000)
    expect(totals.couponDiscountHuf).toBe(2_000)
    expect(totals.pointsDiscountHuf).toBe(1_500)
    expect(totals.merchandiseTotalHuf).toBe(16_500)
    expect(totals.shippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
    expect(totals.finalTotalHuf).toBe(16_500 + STANDARD_SHIPPING_FEE_HUF)

    expect(totals.inStock.items).toHaveLength(1)
    expect(totals.inStock.subtotalHuf).toBe(10_000)
    expect(totals.inStock.couponDiscountHuf).toBe(1_000)
    expect(totals.inStock.shippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)

    expect(totals.sourcing.items).toHaveLength(1)
    expect(totals.sourcing.subtotalHuf).toBe(10_000)
    expect(totals.sourcing.couponDiscountHuf).toBe(1_000)
    expect(totals.sourcing.shippingHuf).toBe(0)

    const splitMerchandise =
      totals.inStock.merchandiseTotalHuf + totals.sourcing.merchandiseTotalHuf
    expect(Math.abs(splitMerchandise - totals.merchandiseTotalHuf)).toBeLessThanOrEqual(200)
  })

  it('assigns shipping to sourcing-only cart', () => {
    const lines = [line('source-1', 1, 5_000, 'procurement')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: {},
      luckySpin: null,
    })

    expect(totals.inStock.shippingHuf).toBe(0)
    expect(totals.sourcing.shippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
    expect(totals.shippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
  })

  it('waives shipping when merchandise reaches free-shipping threshold', () => {
    const lines = [line('stock-1', 1, 30_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: {},
      luckySpin: null,
    })

    expect(totals.merchandiseTotalHuf).toBe(30_000)
    expect(totals.shippingHuf).toBe(0)
    expect(totals.finalTotalHuf).toBe(30_000)
    expect(totals.freeShippingRemainingHuf).toBe(0)
  })
})
