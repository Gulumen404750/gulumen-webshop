import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  mergeResolvedCheckoutCoupons,
  resolveCheckoutCoupons,
} from './coupon-checkout'
import type { ResolvedDbCoupon } from './coupon-checkout'

function coupon(
  partial: Pick<ResolvedDbCoupon, 'id' | 'code' | 'source' | 'eligibleItems'> & {
    discountValue?: number
  }
): ResolvedDbCoupon {
  return {
    discountType: 'percent',
    discountValue: partial.discountValue ?? 10,
    userId: 'u1',
    ...partial,
  }
}

describe('mergeResolvedCheckoutCoupons', () => {
  it('keeps a scoped abandoned-cart percent separate from an extra percent coupon', () => {
    const merged = mergeResolvedCheckoutCoupons([
      {
        coupon: coupon({
          id: 'ab',
          code: 'KOSAR-10-AAA',
          source: 'abandoned_cart',
          eligibleItems: [{ productId: 'p1', qty: 1 }],
          discountValue: 10,
        }),
        discount: { percent: 0.1 },
      },
      {
        coupon: coupon({
          id: 'extra',
          code: 'NYAR10',
          source: 'admin_claim',
          eligibleItems: [],
          discountValue: 10,
        }),
        discount: { percent: 0.1 },
      },
    ])
    expect(merged.ok).toBe(true)
    if (!merged.ok) return
    expect(merged.result.abandonedCart?.couponId).toBe('ab')
    expect(merged.result.abandonedCart?.percent).toBe(0.1)
    expect(merged.result.percent).toBe(0.1)
    expect(merged.result.primaryCouponId).toBe('ab')
    expect(merged.result.secondaryCouponId).toBe('extra')
  })

  it('still blocks two regular percent coupons', () => {
    const merged = mergeResolvedCheckoutCoupons([
      {
        coupon: coupon({ id: 'a', code: 'A', source: 'birthday', eligibleItems: [] }),
        discount: { percent: 0.15 },
      },
      {
        coupon: coupon({ id: 'b', code: 'B', source: 'registration', eligibleItems: [] }),
        discount: { percent: 0.1 },
      },
    ])
    expect(merged.ok).toBe(false)
  })
})

describe('resolveCheckoutCoupons failure payload', () => {
  it('exposes minOrderHuf so checkout can return the shop-currency threshold', () => {
    type Fail = Extract<Awaited<ReturnType<typeof resolveCheckoutCoupons>>, { ok: false }>
    expectTypeOf<Fail>().toHaveProperty('minOrderHuf')
    expectTypeOf<Fail['minOrderHuf']>().toEqualTypeOf<number | undefined>()
  })
})
