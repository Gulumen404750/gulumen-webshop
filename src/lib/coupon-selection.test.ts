import { describe, expect, it } from 'vitest'
import {
  buildPromoCoupons,
  calculateSelectedCouponPercent,
  canToggleCoupon,
  MAX_COMBINED_COUPON_PERCENT,
} from '@/lib/coupon-selection'
import { ALLOW_CAT_REGISTRATION_STACK } from '@/lib/coupon-config'

const labels = {
  cat: 'Macska 5%',
  registration: 'Regisztráció 10%',
  loyalty: 'Hűség',
  welcome: 'Welcome 10%',
  birthday: 'Születésnap 15%',
}

describe('coupon selection: no stacking, 15% cap', () => {
  const coupons = buildPromoCoupons({
    catClaimed: true,
    registrationClaimed: true,
    loyaltyPercent: 5,
    welcomeEligible: true,
    birthday: { code: 'BDAY15', percent: 15 },
    labels,
  })

  it('lists available coupons', () => {
    expect(coupons.map((c) => c.id).sort()).toEqual(
      ['birthday', 'cat', 'loyalty', 'registration', 'welcome'].sort()
    )
  })

  it('lists loyalty first so the 1–8% discount is visible at checkout', () => {
    expect(coupons[0]?.id).toBe('loyalty')
    expect(coupons[0]?.percent).toBeCloseTo(0.05)
  })

  it('omits loyalty when the percent is still 0', () => {
    const withoutLoyalty = buildPromoCoupons({
      catClaimed: false,
      registrationClaimed: false,
      loyaltyPercent: 0,
      labels,
    })
    expect(withoutLoyalty.some((c) => c.id === 'loyalty')).toBe(false)
  })

  it('keeps coupon stacking disabled', () => {
    expect(ALLOW_CAT_REGISTRATION_STACK).toBe(false)
  })

  it('lists a redeemed gamification coupon in available checkout coupons', () => {
    const withPointsCoupon = buildPromoCoupons({
      catClaimed: false,
      registrationClaimed: false,
      gamification: { code: 'GLM-ABCDEF123456', percent: 10 },
      labels: { ...labels, gamification: 'Pontból váltott kupon (10%)' },
    })
    expect(withPointsCoupon).toEqual([
      expect.objectContaining({
        id: 'gamification',
        percent: 0.1,
        code: 'GLM-ABCDEF123456',
      }),
    ])
    const selected = calculateSelectedCouponPercent(withPointsCoupon, ['gamification'])
    expect(selected.finalPercent).toBeCloseTo(0.1)
    expect(selected.gamificationCode).toBe('GLM-ABCDEF123456')
    expect(selected.useGamification).toBe(true)
  })

  it('applies a single cat or registration coupon without stacking', () => {
    const catOnly = calculateSelectedCouponPercent(coupons, ['cat'])
    expect(catOnly.finalPercent).toBeCloseTo(0.05)
    expect(catOnly.capped).toBe(false)

    const registrationOnly = calculateSelectedCouponPercent(coupons, ['registration'])
    expect(registrationOnly.finalPercent).toBeCloseTo(0.1)
    expect(registrationOnly.capped).toBe(false)
  })

  it('caps stacked percents at 15% if both were sent', () => {
    const result = calculateSelectedCouponPercent(coupons, ['cat', 'registration'])
    expect(result.rawPercent).toBeCloseTo(0.15)
    expect(result.finalPercent).toBeCloseTo(0.15)
    expect(result.capped).toBe(false)
  })

  it('caps birthday + registration (25% → 15%)', () => {
    const result = calculateSelectedCouponPercent(coupons, ['birthday', 'registration'])
    expect(result.rawPercent).toBeCloseTo(0.25)
    expect(result.finalPercent).toBeCloseTo(MAX_COMBINED_COUPON_PERCENT)
    expect(result.capped).toBe(true)
  })

  it('allows birthday 15% alone', () => {
    const empty = new Set<typeof coupons[number]['id']>()
    expect(canToggleCoupon(coupons, empty, 'birthday', true)).toBe(true)
    const selected = calculateSelectedCouponPercent(coupons, ['birthday'])
    expect(selected.finalPercent).toBeCloseTo(0.15)
    expect(selected.capped).toBe(false)
  })

  it('blocks selecting a second coupon of any type', () => {
    const withBirthday = new Set(['birthday'] as const)
    const withReg = new Set(['registration'] as const)
    const withCat = new Set(['cat'] as const)
    expect(canToggleCoupon(coupons, withBirthday, 'cat', true)).toBe(false)
    expect(canToggleCoupon(coupons, withBirthday, 'registration', true)).toBe(false)
    expect(canToggleCoupon(coupons, withReg, 'cat', true)).toBe(false)
    expect(canToggleCoupon(coupons, withCat, 'registration', true)).toBe(false)
    expect(canToggleCoupon(coupons, withReg, 'welcome', true)).toBe(false)
    expect(canToggleCoupon(coupons, withReg, 'cat', false)).toBe(true)
  })

  it('caps a 20% gamification coupon to 15% so it remains selectable', () => {
    const withHighCoupon = buildPromoCoupons({
      catClaimed: false,
      registrationClaimed: false,
      gamification: { code: 'GLM-HIGH', percent: 20 },
      labels: { ...labels, gamification: 'Pontból váltott kupon' },
    })
    expect(withHighCoupon[0]?.percent).toBeCloseTo(MAX_COMBINED_COUPON_PERCENT)
    const empty = new Set<typeof withHighCoupon[number]['id']>()
    expect(canToggleCoupon(withHighCoupon, empty, 'gamification', true)).toBe(true)
  })
})
