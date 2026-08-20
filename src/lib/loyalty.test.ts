import { describe, expect, it } from 'vitest'
import {
  getLoyaltyTier,
  getLoyaltyDisplayTier,
  loyaltyPercentFromCount,
  paidGroupQualifiesForLoyalty,
  qualifiesForLoyalty,
  LOYALTY_MAX_PERCENT,
  LOYALTY_THRESHOLD_HUF,
} from './loyalty'

describe('loyaltyPercentFromCount', () => {
  it('is 1% after the first qualifying order and caps at 5%', () => {
    expect(loyaltyPercentFromCount(0)).toBe(0)
    expect(loyaltyPercentFromCount(1)).toBe(1)
    expect(loyaltyPercentFromCount(5)).toBe(5)
    expect(loyaltyPercentFromCount(8)).toBe(LOYALTY_MAX_PERCENT)
    expect(loyaltyPercentFromCount(20)).toBe(LOYALTY_MAX_PERCENT)
  })
})

describe('getLoyaltyTier', () => {
  it('maps 0% to mystery and 1–5% to Réz–Gyémánt', () => {
    expect(getLoyaltyTier(0)).toBeNull()
    expect(getLoyaltyDisplayTier(0)).toBe('mystery')
    expect(getLoyaltyTier(1)).toBe('copper')
    expect(getLoyaltyTier(2)).toBe('silver')
    expect(getLoyaltyTier(3)).toBe('gold')
    expect(getLoyaltyTier(4)).toBe('platinum')
    expect(getLoyaltyTier(5)).toBe('diamond')
    expect(getLoyaltyTier(8)).toBe('diamond')
  })
})

describe('qualifiesForLoyalty', () => {
  it('requires 50 000 HUF paid on the card', () => {
    expect(qualifiesForLoyalty(LOYALTY_THRESHOLD_HUF - 1, 'huf')).toBe(false)
    expect(qualifiesForLoyalty(LOYALTY_THRESHOLD_HUF, 'huf')).toBe(true)
    expect(qualifiesForLoyalty(80_000, 'HUF')).toBe(true)
  })
})

describe('paidGroupQualifiesForLoyalty', () => {
  it('does not qualify a 50k+ card remainder when any points were spent', () => {
    expect(
      paidGroupQualifiesForLoyalty([
        { totalHuf: 50_000, pointsUsed: 0, pointsDiscountHuf: 0, giftPointsUsed: 0 },
      ])
    ).toBe(true)
    expect(
      paidGroupQualifiesForLoyalty([
        { totalHuf: 52_000, pointsUsed: 2_000, pointsDiscountHuf: 2_000, giftPointsUsed: 0 },
      ])
    ).toBe(false)
    expect(
      paidGroupQualifiesForLoyalty([
        { totalHuf: 50_000, pointsUsed: 0 },
        { totalHuf: 8_000, pointsUsed: 500, pointsDiscountHuf: 500 },
      ])
    ).toBe(false)
    expect(
      paidGroupQualifiesForLoyalty([{ totalHuf: 80_000, usedPoints: 1 }])
    ).toBe(false)
  })
})
