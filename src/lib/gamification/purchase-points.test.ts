import { describe, expect, it } from 'vitest'
import {
  computeMixedPointsRedemption,
  splitWalletBalances,
  cashPaidHufToEarnPoints,
  earnPointsForCart,
  purchaseEarnPointsForOrder,
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
  it('lets gift points cover 100% of merchandise and activity the leftover 1:1', () => {
    const result = computeMixedPointsRedemption({
      merchandiseHuf: 10_000,
      requestedDiscountHuf: 10_000,
      userBalance: 10_000,
      giftPointsAvailable: 4_000,
    })
    expect(result.giftPointsUsed).toBe(4_000)
    expect(result.activityPointsUsed).toBe(6_000)
    expect(result.pointsDiscountHuf).toBe(10_000)
    expect(result.pointsUsed).toBe(10_000)
  })

  it('does not cap gift-only spend below 100% of merchandise', () => {
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

  it('lets activity points cover 100% when only activity is spent', () => {
    const result = computeMixedPointsRedemption({
      merchandiseHuf: 10_000,
      requestedDiscountHuf: 10_000,
      userBalance: 10_000,
      giftPointsAvailable: 0,
      spendGift: false,
      spendActivity: true,
    })
    expect(result.giftPointsUsed).toBe(0)
    expect(result.activityPointsUsed).toBe(10_000)
    expect(result.pointsDiscountHuf).toBe(10_000)
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

describe('cashPaidHufToEarnPoints', () => {
  it('gives 1 point per 100 HUF paid with money', () => {
    expect(cashPaidHufToEarnPoints(0)).toBe(0)
    expect(cashPaidHufToEarnPoints(99)).toBe(0)
    expect(cashPaidHufToEarnPoints(100)).toBe(1)
    expect(cashPaidHufToEarnPoints(199)).toBe(1)
    expect(cashPaidHufToEarnPoints(250)).toBe(2)
    expect(cashPaidHufToEarnPoints(10_099)).toBe(100)
    expect(cashPaidHufToEarnPoints(25_000)).toBe(250)
  })

  it('ignores invalid amounts', () => {
    expect(cashPaidHufToEarnPoints(-500)).toBe(0)
    expect(cashPaidHufToEarnPoints(Number.NaN)).toBe(0)
  })
})

describe('earnPointsForCart zero-point rule', () => {
  it('returns 0 immediately when cart.usedPoints > 0, including the 50k band', () => {
    expect(
      earnPointsForCart({
        userId: 'u1',
        usedPoints: 1,
        paidHuf: 80_000,
        totalHuf: 80_000,
      })
    ).toBe(0)
    expect(
      earnPointsForCart({
        userId: 'u1',
        usedPoints: 500,
        pointsUsed: 0,
        paidHuf: 55_000,
      })
    ).toBe(0)
  })
})

describe('purchaseEarnPointsForOrder', () => {
  it('earns 1 point per 100 HUF on a pure card/cash order', () => {
    expect(
      purchaseEarnPointsForOrder({
        userId: 'u1',
        totalHuf: 6_190,
        pointsUsed: 0,
        giftPointsUsed: 0,
        pointsDiscountHuf: 0,
      })
    ).toBe(61)
  })

  it('credits nothing when any points were spent on the order', () => {
    expect(
      purchaseEarnPointsForOrder({
        userId: 'u1',
        totalHuf: 6_190,
        pointsUsed: 500,
        giftPointsUsed: 0,
        pointsDiscountHuf: 500,
      })
    ).toBe(0)
    expect(
      purchaseEarnPointsForOrder({
        userId: 'u1',
        totalHuf: 0,
        pointsUsed: 10_000,
        giftPointsUsed: 4_000,
        pointsDiscountHuf: 10_000,
      })
    ).toBe(0)
    expect(
      purchaseEarnPointsForOrder({
        userId: 'u1',
        totalHuf: 1_990,
        pointsUsed: 0,
        giftPointsUsed: 200,
        pointsDiscountHuf: 0,
      })
    ).toBe(0)
  })

  it('credits nothing for guests', () => {
    expect(purchaseEarnPointsForOrder({ userId: null, totalHuf: 5_000 })).toBe(0)
  })

  it('credits nothing for Klarna instalments', () => {
    expect(
      purchaseEarnPointsForOrder({
        userId: 'u1',
        totalHuf: 6_190,
        pointsUsed: 0,
        giftPointsUsed: 0,
        pointsDiscountHuf: 0,
        paymentMethod: 'klarna',
      })
    ).toBe(0)
    expect(
      purchaseEarnPointsForOrder({
        userId: 'u1',
        totalHuf: 6_190,
        paymentMethod: 'paypal',
      })
    ).toBe(61)
  })

  it('credits nothing on a 50k+ card remainder if any points were spent on the group', () => {
    expect(
      purchaseEarnPointsForOrder({
        userId: 'u1',
        totalHuf: 55_000,
        pointsUsed: 0,
        giftPointsUsed: 0,
        pointsDiscountHuf: 0,
        groupUsedInternalPoints: true,
      })
    ).toBe(0)
    expect(
      purchaseEarnPointsForOrder({
        userId: 'u1',
        totalHuf: 55_000,
        paidHuf: 50_000,
        pointsUsed: 1,
        pointsDiscountHuf: 1,
      })
    ).toBe(0)
  })
})
