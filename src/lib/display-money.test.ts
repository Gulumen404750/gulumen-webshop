import { describe, expect, it } from 'vitest'
import { FALLBACK_HUF_PER_EUR, hufToEur } from './euro-rate'
import {
  formatEurLabel,
  formatMoneyFromHuf,
  pointsCopyVars,
  usesEuroCopy,
} from './display-money'
import { LOYALTY_THRESHOLD_HUF } from './loyalty'
import { FREE_SHIPPING_THRESHOLD, PURCHASE_EARN_HUF_PER_POINT } from './gamification/constants'

describe('formatMoneyFromHuf', () => {
  const rate = 395

  it('keeps forint labels in Hungarian', () => {
    expect(formatMoneyFromHuf(25_000, 'hu', rate)).toMatch(/25.000 Ft/)
    expect(formatMoneyFromHuf(1, 'hu', rate)).toBe('1 Ft')
  })

  it('converts thresholds to live EUR for English/German/Romanian', () => {
    const shippingEur = formatEurLabel(hufToEur(FREE_SHIPPING_THRESHOLD, rate), 'en')
    const loyaltyEur = formatEurLabel(hufToEur(LOYALTY_THRESHOLD_HUF, rate), 'en')
    expect(formatMoneyFromHuf(FREE_SHIPPING_THRESHOLD, 'en', rate)).toBe(shippingEur)
    expect(formatMoneyFromHuf(LOYALTY_THRESHOLD_HUF, 'de', rate)).toContain('€')
    expect(formatMoneyFromHuf(LOYALTY_THRESHOLD_HUF, 'en', rate)).toBe(loyaltyEur)
    expect(formatMoneyFromHuf(PURCHASE_EARN_HUF_PER_POINT, 'en', rate)).toBe(
      formatEurLabel(hufToEur(100, rate), 'en')
    )
  })

  it('does not round 1 point (1 HUF) to €0.00', () => {
    const onePoint = formatMoneyFromHuf(1, 'en', rate)
    expect(onePoint).toMatch(/^€0\.00[1-9]/)
    expect(onePoint).not.toBe('€0.00')
    expect(onePoint).not.toMatch(/HUF|Ft/)
  })
})

describe('pointsCopyVars', () => {
  it('fills EUR placeholders without leftover HUF in English', () => {
    const vars = pointsCopyVars('en', FALLBACK_HUF_PER_EUR)
    expect(vars.pointValue).toMatch(/^€/)
    expect(vars.earnAmount).toMatch(/^€/)
    expect(vars.shippingThreshold).toMatch(/^€/)
    expect(vars.loyaltyThreshold).toMatch(/^€/)
    expect(vars.rate).toBe('1')
    expect(usesEuroCopy('en')).toBe(true)
    expect(usesEuroCopy('hu')).toBe(false)
  })
})

describe('loyalty threshold constant', () => {
  it('matches the display helper (50 000 Ft)', () => {
    expect(LOYALTY_THRESHOLD_HUF).toBe(50_000)
  })
})
