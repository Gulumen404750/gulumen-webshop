import { describe, expect, it } from 'vitest'
import {
  computeMixedPointsRedemption,
  splitWalletBalances,
} from './purchase-points'

describe('splitWalletBalances', () => {
  it('treats gift remainder as a subset of the total wallet', () => {
    expect(splitWalletBalances(10_000, 4_000)).toEqual({
      giftBalance: 4_000,
      activityBalance: 6_000,
    })
  })

  it('caps gift at the total balance', () => {
    expect(splitWalletBalances(1_000, 5_000)).toEqual({
      giftBalance: 1_000,
      activityBalance: 0,
    })
  })
})

describe('computeMixedPointsRedemption', () => {
  it('lets gift points cover 100% of merchandise and activity 30% of the leftover', () => {
    const result = computeMixedPointsRedemption({
      merchandiseHuf: 10_000,
      requestedDiscountHuf: 10_000,
      userBalance: 10_000,
      giftPointsAvailable: 4_000,
    })
    expect(result.giftPointsUsed).toBe(4_000)
    expect(result.activityPointsUsed).toBe(1_800)
    expect(result.pointsDiscountHuf).toBe(5_800)
    expect(result.pointsUsed).toBe(5_800)
  })

  it('does not apply the 30% cap to gift-only spend', () => {
    const result = computeMixedPointsRedemption({
      merchandiseHuf: 10_000,
      requestedDiscountHuf: 10_000,
      userBalance: 10_000,
      giftPointsAvailable: 10_000,
      spendGift: true,
      spendActivity: false,
    })
    expect(result).toEqual({
      pointsDiscountHuf: 10_000,
      pointsUsed: 10_000,
      giftPointsUsed: 10_000,
      activityPointsUsed: 0,
    })
  })

  it('keeps the 30% cap when only activity points are spent', () => {
    const result = computeMixedPointsRedemption({
      merchandiseHuf: 10_000,
      requestedDiscountHuf: 10_000,
      userBalance: 10_000,
      giftPointsAvailable: 8_000,
      spendGift: false,
      spendActivity: true,
    })
    expect(result.giftPointsUsed).toBe(0)
    expect(result.activityPointsUsed).toBe(2_000)
    expect(result.pointsDiscountHuf).toBe(2_000)
  })

  it('never covers more than merchandise (shipping stays on the customer)', () => {
    const result = computeMixedPointsRedemption({
      merchandiseHuf: 1_000,
      requestedDiscountHuf: 50_000,
      userBalance: 50_000,
      giftPointsAvailable: 50_000,
    })
    expect(result.pointsDiscountHuf).toBe(1_000)
    expect(result.giftPointsUsed).toBe(1_000)
  })
})
