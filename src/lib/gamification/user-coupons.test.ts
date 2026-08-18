import { describe, expect, it } from 'vitest'
import {
  canRedeemFromBalance,
  mapUserGamificationCoupon,
  pickActiveCheckoutCoupon,
  redeemableCouponCount,
  sortUserGamificationCoupons,
} from './user-coupons'

const now = new Date('2026-08-18T12:00:00.000Z')

function row(
  overrides: Partial<{
    id: string
    code: string
    discountType: string
    discountValue: number
    active: boolean
    usedCount: number
    maxUses: number | null
    createdAt: string
    validUntil: string | null
  }> = {}
) {
  return {
    id: 'c1',
    code: 'GLM-AAAA11111111',
    discountType: 'percent',
    discountValue: 10,
    active: true,
    usedCount: 0,
    maxUses: 1,
    createdAt: '2026-08-18T10:00:00.000Z',
    validUntil: '2026-09-17T10:00:00.000Z',
    ...overrides,
  }
}

describe('canRedeemFromBalance', () => {
  it('allows a second 10% coupon when an unused one already exists', () => {
    expect(canRedeemFromBalance(753, 350, false)).toBe(true)
    expect(canRedeemFromBalance(349, 350, false)).toBe(false)
    expect(canRedeemFromBalance(700, 350, true)).toBe(false)
  })
})

describe('redeemableCouponCount', () => {
  it('counts how many 10% coupons the current balance can buy', () => {
    expect(redeemableCouponCount(753, 350)).toBe(2)
    expect(redeemableCouponCount(350, 350)).toBe(1)
    expect(redeemableCouponCount(349, 350)).toBe(0)
    expect(redeemableCouponCount(1050, 350, true)).toBe(0)
  })
})

describe('mapUserGamificationCoupon', () => {
  it('maps an unused live coupon as active 10%', () => {
    const mapped = mapUserGamificationCoupon(row(), now)
    expect(mapped.status).toBe('active')
    expect(mapped.discountPercent).toBe(10)
    expect(mapped.code).toBe('GLM-AAAA11111111')
  })

  it('maps a spent coupon as used', () => {
    expect(mapUserGamificationCoupon(row({ usedCount: 1 }), now).status).toBe('used')
  })
})

describe('sortUserGamificationCoupons + pickActiveCheckoutCoupon', () => {
  it('lists active coupons first and checkout picks one unused code', () => {
    const coupons = sortUserGamificationCoupons([
      mapUserGamificationCoupon(row({ id: 'used', code: 'GLM-USED', usedCount: 1, createdAt: '2026-08-18T11:00:00.000Z' }), now),
      mapUserGamificationCoupon(row({ id: 'old', code: 'GLM-OLD', createdAt: '2026-08-01T10:00:00.000Z' }), now),
      mapUserGamificationCoupon(row({ id: 'new', code: 'GLM-NEW', createdAt: '2026-08-18T11:30:00.000Z' }), now),
    ])
    expect(coupons.map((c) => c.code)).toEqual(['GLM-NEW', 'GLM-OLD', 'GLM-USED'])
    expect(pickActiveCheckoutCoupon(coupons)?.code).toBe('GLM-NEW')
  })
})
