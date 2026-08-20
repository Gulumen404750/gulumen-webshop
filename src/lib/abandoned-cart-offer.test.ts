import { describe, expect, it } from 'vitest'
import {
  computeAbandonedCartDiscountHuf,
  computeEligibleSubtotalHuf,
  eligibleItemsFromCart,
  eligibleOptionsMatch,
  parseEligibleItems,
  takeEligibleQty,
} from './abandoned-cart-offer'

describe('abandoned cart eligible qty', () => {
  it('caps discount qty and leaves extras at full price', () => {
    const pool = parseEligibleItems([{ productId: 'a', qty: 1 }])
    expect(takeEligibleQty(pool, 'a', 3)).toBe(1)
    expect(takeEligibleQty(pool, 'a', 1)).toBe(0)
  })

  it('does not apply the offer to a different product', () => {
    const pool = [{ productId: 'a', qty: 2 }]
    expect(takeEligibleQty(pool, 'b', 2)).toBe(0)
  })

  it('matches color when the frozen line has a color', () => {
    expect(
      eligibleOptionsMatch({ colorHex: '#ff0000', colorName: 'Piros' }, { colorHex: '#ff0000' })
    ).toBe(true)
    expect(
      eligibleOptionsMatch({ colorHex: '#ff0000' }, { colorHex: '#00ff00' })
    ).toBe(false)
  })

  it('treats missing eligible color as a product-level cap', () => {
    expect(eligibleOptionsMatch(undefined, { colorHex: '#ff0000' })).toBe(true)
  })

  it('merges the same cart line when freezing an offer', () => {
    const items = eligibleItemsFromCart([
      { productId: 'a', qty: 1, options: { colorHex: '#fff' } },
      { productId: 'a', qty: 2, options: { colorHex: '#fff' } },
    ])
    expect(items).toEqual([{ productId: 'a', qty: 3, options: { colorHex: '#fff' } }])
  })
})

describe('computeAbandonedCartDiscountHuf', () => {
  const lines = [
    { productId: 'a', qty: 3, priceHuf: 10_000 },
    { productId: 'b', qty: 1, priceHuf: 8_000 },
  ]

  it('applies percent only to the frozen qty', () => {
    const discount = computeAbandonedCartDiscountHuf(lines, {
      percent: 0.1,
      eligibleItems: [{ productId: 'a', qty: 1 }],
    })
    expect(computeEligibleSubtotalHuf(lines, [{ productId: 'a', qty: 1 }])).toBe(10_000)
    expect(discount).toBe(1_000)
  })

  it('does not discount new products', () => {
    const discount = computeAbandonedCartDiscountHuf(lines, {
      percent: 0.15,
      eligibleItems: [{ productId: 'a', qty: 1 }],
    })
    expect(discount).toBe(1_500)
  })
})
