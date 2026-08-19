import { describe, expect, it } from 'vitest'
import {
  computeCheckoutTotals,
  computeCouponDiscountHuf,
  applyFixedCouponHuf,
  stackFixedThenPercent,
  computePointsRedemption,
  computeShippingHuf,
  calculateDiscount,
  resolveCartLines,
  validateCouponPercent,
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

  it('caps percent coupon at full-price subtotal', () => {
    const lines = [line('a', 1, 500)]
    expect(computeCouponDiscountHuf(lines, { percent: 0.5 })).toBe(250)
    expect(computeCouponDiscountHuf(lines, { percent: 2 })).toBe(500)
  })
})

describe('computePointsRedemption', () => {
  it('lets regular points cover 100% of the product price at 1 pont = 1 Ft', () => {
    const result = computePointsRedemption(10_000, {
      requestedDiscountHuf: 10_000,
      userBalance: 50_000,
    })
    expect(result.pointsDiscountHuf).toBe(10_000)
    expect(result.pointsUsed).toBe(10_000)
  })

  it('lets NFC gift points cover the full merchandise amount', () => {
    const result = computePointsRedemption(10_000, {
      requestedDiscountHuf: 10_000,
      userBalance: 10_000,
      giftPointsAvailable: 10_000,
    })
    expect(result.pointsDiscountHuf).toBe(10_000)
    expect(result.pointsUsed).toBe(10_000)
    expect(result.giftPointsUsed).toBe(10_000)
    expect(result.activityPointsUsed).toBe(0)
  })

  it('lets activity points cover leftover merchandise after gift 1:1', () => {
    const result = computePointsRedemption(10_000, {
      requestedDiscountHuf: 10_000,
      userBalance: 10_000,
      giftPointsAvailable: 4_000,
    })
    expect(result.giftPointsUsed).toBe(4_000)
    expect(result.activityPointsUsed).toBe(6_000)
    expect(result.pointsDiscountHuf).toBe(10_000)
  })

  it('rejects redemption when balance is insufficient', () => {
    const result = computePointsRedemption(10_000, {
      requestedDiscountHuf: 1_000,
      userBalance: 0,
    })
    expect(result).toEqual({
      pointsDiscountHuf: 0,
      pointsUsed: 0,
      giftPointsUsed: 0,
      activityPointsUsed: 0,
    })
  })
})

describe('computeShippingHuf', () => {
  it('charges standard fee below free-shipping threshold', () => {
    expect(computeShippingHuf(FREE_SHIPPING_THRESHOLD - 1)).toBe(STANDARD_SHIPPING_FEE_HUF)
  })

  it('is free at or above threshold when not using points', () => {
    expect(computeShippingHuf(FREE_SHIPPING_THRESHOLD)).toBe(0)
    expect(computeShippingHuf(FREE_SHIPPING_THRESHOLD + 1)).toBe(0)
  })

  it('charges shipping when the product is fully paid with points, even above the threshold', () => {
    expect(computeShippingHuf(0, { hasItems: true })).toBe(STANDARD_SHIPPING_FEE_HUF)
  })

  it('still grants free shipping when leftover card merchandise is at or above the threshold', () => {
    expect(
      computeShippingHuf(FREE_SHIPPING_THRESHOLD + 5_000, { hasItems: true })
    ).toBe(0)
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

  it('uses admin material and ignores guest cart material', () => {
    const map = new Map<string, Product>([
      ['p1', product({ id: 'p1', priceHuf: 2000, materials: ['PLA', 'PETG'] })],
    ])
    const lines = resolveCartLines(
      [{ productId: 'p1', qty: 2, options: { colorName: 'Kék', colorHex: '#0000ff', materialName: 'PETG' } }],
      map
    )
    expect(lines[0]).toEqual(
      expect.objectContaining({
        productId: 'p1',
        qty: 2,
        parameters: { colorName: 'Kék', colorHex: '#0000ff', materialName: 'PLA' },
      })
    )
  })

  it('does not let the guest spoof a material the product is not set to', () => {
    const map = new Map<string, Product>([
      ['p1', product({ id: 'p1', priceHuf: 2000, materials: ['PLA'] })],
    ])
    const lines = resolveCartLines(
      [{ productId: 'p1', qty: 1, options: { materialName: 'PETG' } }],
      map
    )
    expect(lines[0]?.parameters).toEqual({ materialName: 'PLA' })
  })

  it('fills default PLA and base color when cart options are missing', () => {
    const map = new Map<string, Product>([
      [
        'p1',
        product({
          id: 'p1',
          priceHuf: 2000,
          materials: ['PLA'],
          colorImages: [{ id: 'pink', name: 'Rózsaszín', hex: '#ff69b4', images: ['/a.jpg'], isBase: true }],
        }),
      ],
    ])
    const lines = resolveCartLines([{ productId: 'p1', qty: 2 }], map)
    expect(lines[0]?.parameters).toEqual({
      colorName: 'Rózsaszín',
      colorHex: '#ff69b4',
      materialName: 'PLA',
    })
  })
})

describe('computeCheckoutTotals', () => {
  it('stacks a percent coupon with points and charges shipping below the free-shipping leftover', () => {
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
    expect(totals.pointsUsed).toBe(1_500)
    expect(totals.merchandiseTotalHuf).toBe(16_500)
    expect(totals.shippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
    expect(totals.finalTotalHuf).toBe(16_500 + STANDARD_SHIPPING_FEE_HUF)

    expect(totals.inStock.items).toHaveLength(1)
    expect(totals.inStock.subtotalHuf).toBe(10_000)
    expect(totals.inStock.shippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)

    expect(totals.sourcing.items).toHaveLength(1)
    expect(totals.sourcing.subtotalHuf).toBe(10_000)
    expect(totals.sourcing.shippingHuf).toBe(0)
  })

  it('splits coupon discount without points', () => {
    const lines = [
      line('stock-1', 2, 5_000, 'stock'),
      line('source-1', 1, 10_000, 'procurement'),
    ]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0.1 },
      luckySpin: null,
    })
    expect(totals.couponDiscountHuf).toBe(2_000)
    expect(totals.pointsDiscountHuf).toBe(0)
    expect(totals.inStock.couponDiscountHuf).toBe(1_000)
    expect(totals.sourcing.couponDiscountHuf).toBe(1_000)
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

  it('keeps free shipping when leftover card merchandise stays at or above the threshold', () => {
    const lines = [line('stock-1', 1, 40_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: {},
      luckySpin: null,
      points: { requestedDiscountHuf: 3_000, userBalance: 50_000 },
    })
    expect(totals.pointsDiscountHuf).toBe(3_000)
    expect(totals.merchandiseTotalHuf).toBe(37_000)
    expect(totals.shippingHuf).toBe(0)
    expect(totals.finalTotalHuf).toBe(37_000)
    expect(totals.invoiceMerchandiseHuf).toBe(37_000)
    expect(totals.invoiceShippingHuf).toBe(0)
    expect(totals.invoiceTotalHuf).toBe(37_000)
  })

  it('charges shipping when an order over 25 000 Ft is paid only with points', () => {
    const lines = [line('stock-1', 1, 40_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: {},
      luckySpin: null,
      points: { requestedDiscountHuf: 40_000, userBalance: 50_000 },
    })
    expect(totals.pointsDiscountHuf).toBe(40_000)
    expect(totals.merchandiseTotalHuf).toBe(0)
    expect(totals.shippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
    expect(totals.invoiceMerchandiseHuf).toBe(0)
    expect(totals.invoiceShippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
    expect(totals.invoiceTotalHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
  })

  it('splits gift vs activity and shows the unpaid remainder as invoice due', () => {
    const lines = [line('stock-1', 1, 10_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0.1 },
      luckySpin: null,
      points: {
        requestedDiscountHuf: 10_000,
        userBalance: 10_000,
        giftPointsAvailable: 4_000,
      },
    })

    expect(totals.couponDiscountHuf).toBe(1_000)
    expect(totals.giftPointsUsed).toBe(4_000)
    expect(totals.activityPointsUsed).toBe(5_000)
    expect(totals.pointsDiscountHuf).toBe(9_000)
    expect(totals.invoiceMerchandiseHuf).toBe(0)
    expect(totals.invoiceShippingHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
    expect(totals.invoiceTotalHuf).toBe(STANDARD_SHIPPING_FEE_HUF)
    expect(totals.inStock.giftPointsUsed).toBe(4_000)
    expect(totals.inStock.invoiceTotalHuf).toBe(totals.invoiceTotalHuf)
  })

  it('applies loyalty first and still stacks a single coupon on top', () => {
    const lines = [line('stock-1', 1, 10_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0.1 },
      luckySpin: null,
      loyaltyPercent: 0.01,
    })
    expect(totals.loyaltyDiscountHuf).toBe(100)
    expect(totals.couponDiscountHuf).toBe(990)
    expect(totals.merchandiseTotalHuf).toBe(8_910)
  })

  it('keeps loyalty and a percent coupon when paying with points', () => {
    const lines = [line('stock-1', 1, 10_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0.1 },
      luckySpin: null,
      loyaltyPercent: 0.02,
      points: { requestedDiscountHuf: 2_000, userBalance: 50_000 },
    })
    expect(totals.loyaltyDiscountHuf).toBe(200)
    expect(totals.couponDiscountHuf).toBe(980)
    expect(totals.pointsDiscountHuf).toBe(2_000)
    expect(totals.merchandiseTotalHuf).toBe(6_820)
  })

  it('applies loyalty, a coupon, then activity points without zeroing the coupon', () => {
    const lines = [line('stock-1', 1, 10_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0.1 },
      luckySpin: null,
      loyaltyPercent: 0.04,
      points: {
        requestedDiscountHuf: 2_000,
        userBalance: 50_000,
        spendGift: false,
        spendActivity: true,
      },
    })
    expect(totals.loyaltyDiscountHuf).toBe(400)
    expect(totals.couponDiscountHuf).toBe(960)
    expect(totals.percentCouponDiscountHuf).toBe(960)
    expect(totals.pointsDiscountHuf).toBe(2_000)
    expect(totals.activityPointsUsed).toBe(2_000)
    expect(totals.giftPointsUsed).toBe(0)
    expect(totals.merchandiseTotalHuf).toBe(6_640)
  })

  it('applies a fixed coupon before points on the remaining merchandise', () => {
    const lines = [line('stock-1', 1, 20_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { fixedHuf: 5_000 },
      luckySpin: null,
      points: { requestedDiscountHuf: 3_000, userBalance: 50_000 },
    })
    expect(totals.fixedCouponDiscountHuf).toBe(5_000)
    expect(totals.couponDiscountHuf).toBe(5_000)
    expect(totals.pointsDiscountHuf).toBe(3_000)
    expect(totals.merchandiseTotalHuf).toBe(12_000)
  })

  it('applies loyalty first, then (cart - fixed) * (1 - percent)', () => {
    const lines = [line('stock-1', 1, 20_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0.1, fixedHuf: 5_000 },
      luckySpin: null,
      loyaltyPercent: 0.05,
    })
    expect(totals.loyaltyDiscountHuf).toBe(1_000)
    expect(totals.fixedCouponDiscountHuf).toBe(5_000)
    expect(totals.percentCouponDiscountHuf).toBe(1_400)
    expect(totals.fixedCouponUnusedHuf).toBe(0)
    expect(totals.merchandiseTotalHuf).toBe(12_600)
  })

  it('uses (cart - 15 000 Ft) * (1 - 15%) for a stacked gift coupon and wheel percent', () => {
    const lines = [line('stock-1', 1, 20_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0.15, fixedHuf: 15_000 },
      luckySpin: null,
    })
    expect(totals.fixedCouponDiscountHuf).toBe(15_000)
    expect(totals.percentCouponDiscountHuf).toBe(750)
    expect(totals.merchandiseTotalHuf).toBe(4_250)
  })

  it('applies a fixed coupon before Lucky Spin and drops the unused remainder', () => {
    const spin = {
      id: 'spin-1',
      userId: 'u1',
      weekId: '2026-W01',
      productIds: ['spin-1'],
      priceSnapshot: { 'spin-1': 10_000 },
      generatedAt: new Date('2026-01-01'),
      expiresAt: new Date('2099-01-01'),
    }
    const lines = [line('spin-1', 1, 10_000, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { fixedHuf: 15_000 },
      luckySpin: spin,
    })
    expect(totals.fixedCouponDiscountHuf).toBe(10_000)
    expect(totals.fixedCouponUnusedHuf).toBe(5_000)
    expect(totals.luckySpinDiscountHuf).toBe(0)
    expect(totals.merchandiseTotalHuf).toBe(0)
  })

  it('applies a 15 000 Ft coupon to a 4 990 Ft cart with 4% loyalty instead of 0%', () => {
    const lines = [line('stock-1', 1, 4_990, 'stock')]
    const totals = computeCheckoutTotals({
      lines,
      coupon: { percent: 0, fixedHuf: 15_000 },
      luckySpin: null,
      loyaltyPercent: 0.04,
    })
    expect(totals.loyaltyDiscountHuf).toBe(200)
    expect(totals.percentCouponDiscountHuf).toBe(0)
    expect(totals.fixedCouponDiscountHuf).toBe(4_790)
    expect(totals.couponDiscountHuf).toBe(4_790)
    expect(totals.fixedCouponUnusedHuf).toBe(10_210)
    expect(totals.merchandiseTotalHuf).toBe(0)
  })
})

describe('stackFixedThenPercent', () => {
  it('applies (cart - fixed) * (1 - percent) and forfeits leftover fixed value', () => {
    expect(stackFixedThenPercent(20_000, 15_000, 0.15)).toEqual({
      appliedFixedHuf: 15_000,
      unusedFixedHuf: 0,
      percentDiscountHuf: 750,
      remainingHuf: 4_250,
    })
    expect(stackFixedThenPercent(8_000, 15_000, 0.15)).toEqual({
      appliedFixedHuf: 8_000,
      unusedFixedHuf: 7_000,
      percentDiscountHuf: 0,
      remainingHuf: 0,
    })
  })
})

describe('applyFixedCouponHuf', () => {
  it('uses the coupon in full and forfeits leftover value', () => {
    expect(applyFixedCouponHuf(8_000, 15_000)).toEqual({ appliedHuf: 8_000, unusedHuf: 7_000 })
    expect(applyFixedCouponHuf(20_000, 15_000)).toEqual({ appliedHuf: 15_000, unusedHuf: 0 })
    expect(applyFixedCouponHuf(0, 15_000)).toEqual({ appliedHuf: 0, unusedHuf: 15_000 })
  })
})

describe('validateCouponPercent', () => {
  it('allows 0 without login', () => {
    expect(validateCouponPercent(0, false)).toBe(true)
  })

  it('rejects positive percent without login', () => {
    expect(validateCouponPercent(0.1, false)).toBe(false)
  })

  it('allows 5/10/15% when logged in', () => {
    expect(validateCouponPercent(0.05, true)).toBe(true)
    expect(validateCouponPercent(0.1, true)).toBe(true)
    expect(validateCouponPercent(0.15, true)).toBe(true)
  })

  it('rejects more than 15%', () => {
    expect(validateCouponPercent(0.2, true)).toBe(false)
    expect(validateCouponPercent(0.25, true)).toBe(false)
  })
})
