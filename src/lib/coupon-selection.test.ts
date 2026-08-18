import { describe, expect, it } from 'vitest'
import {
  buildPromoCoupons,
  calculateSelectedCouponPercent,
  canToggleCoupon,
  gamificationCouponId,
  MAX_COMBINED_COUPON_PERCENT,
  nextCouponSelection,
} from '@/lib/coupon-selection'
import { ALLOW_CAT_REGISTRATION_STACK, isCouponStackingBlocked, capLoyaltyPercent } from '@/lib/coupon-config'

const labels = {
  cat: 'Macska 5%',
  registration: 'Regisztráció 10%',
  loyalty: 'Hűség',
  welcome: 'Welcome 10%',
  birthday: 'Születésnap 15%',
}

describe('coupon selection: 15% cap, fixed HUF stacking', () => {
  const coupons = buildPromoCoupons({
    catClaimed: true,
    registrationClaimed: true,
    loyaltyPercent: 5,
    welcomeEligible: true,
    birthday: { code: 'BDAY15', percent: 15 },
    labels,
  })

  it('lists available coupons without loyalty (loyalty is automatic)', () => {
    expect(coupons.map((c) => c.id).sort()).toEqual(
      ['birthday', 'cat', 'registration', 'welcome'].sort()
    )
    expect(coupons.some((c) => c.id === 'loyalty')).toBe(false)
  })

  it('omits loyalty from the selectable list even when the percent is 5+', () => {
    const withLoyalty = buildPromoCoupons({
      catClaimed: false,
      registrationClaimed: false,
      loyaltyPercent: 8,
      labels,
    })
    expect(withLoyalty).toEqual([])
  })

  it('keeps coupon stacking disabled', () => {
    expect(ALLOW_CAT_REGISTRATION_STACK).toBe(false)
  })

  it('keeps percent stacking disabled on the server even if loyalty is marked', () => {
    expect(isCouponStackingBlocked(['loyalty'])).toBe(false)
    expect(isCouponStackingBlocked(['loyalty', 'gamification'])).toBe(false)
    expect(isCouponStackingBlocked(['cat', 'registration'])).toBe(true)
    expect(isCouponStackingBlocked(['cat', 'gamification'], { fixedIds: ['gamification'] })).toBe(false)
    expect(capLoyaltyPercent(1)).toBeCloseTo(0.01)
    expect(capLoyaltyPercent(8)).toBeCloseTo(0.08)
    expect(capLoyaltyPercent(0.03)).toBeCloseTo(0.03)
    expect(capLoyaltyPercent(20)).toBeCloseTo(0.08)
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
        id: gamificationCouponId('GLM-ABCDEF123456'),
        percent: 0.1,
        code: 'GLM-ABCDEF123456',
      }),
    ])
    const selected = calculateSelectedCouponPercent(withPointsCoupon, [
      gamificationCouponId('GLM-ABCDEF123456'),
    ])
    expect(selected.finalPercent).toBeCloseTo(0.1)
    expect(selected.gamificationCode).toBe('GLM-ABCDEF123456')
    expect(selected.useGamification).toBe(true)
  })

  it('lists every active points coupon so checkout can pick one', () => {
    const listed = buildPromoCoupons({
      catClaimed: false,
      registrationClaimed: false,
      gamification: [
        { code: 'GLM-NEW', percent: 10, validUntil: '2026. 09. 17.' },
        { code: 'GLM-OLD', percent: 10, validUntil: '2026. 09. 01.' },
      ],
      labels: { ...labels, gamification: 'Pontból váltott kupon (10%)' },
    })
    expect(listed.map((c) => c.code)).toEqual(['GLM-NEW', 'GLM-OLD'])
    expect(listed.map((c) => c.id)).toEqual([
      gamificationCouponId('GLM-NEW'),
      gamificationCouponId('GLM-OLD'),
    ])
    const pickedOld = calculateSelectedCouponPercent(listed, [gamificationCouponId('GLM-OLD')])
    expect(pickedOld.gamificationCode).toBe('GLM-OLD')
    expect(pickedOld.finalPercent).toBeCloseTo(0.1)
    expect(
      canToggleCoupon(listed, new Set([gamificationCouponId('GLM-NEW')]), gamificationCouponId('GLM-OLD'), true)
    ).toBe(true)
    expect(
      nextCouponSelection(listed, new Set([gamificationCouponId('GLM-NEW')]), gamificationCouponId('GLM-OLD'), true)
    ).toEqual([gamificationCouponId('GLM-OLD')])
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

  it('replaces a percent coupon instead of stacking two percents', () => {
    const withBirthday = new Set(['birthday'] as const)
    const withReg = new Set(['registration'] as const)
    const withCat = new Set(['cat'] as const)
    const withLoyaltyAndReg = new Set(['loyalty', 'registration'] as const)
    expect(nextCouponSelection(coupons, withBirthday, 'cat', true)).toEqual(['cat'])
    expect(nextCouponSelection(coupons, withBirthday, 'registration', true)).toEqual(['registration'])
    expect(nextCouponSelection(coupons, withReg, 'cat', true)).toEqual(['cat'])
    expect(nextCouponSelection(coupons, withCat, 'registration', true)).toEqual(['registration'])
    expect(nextCouponSelection(coupons, withReg, 'welcome', true)).toEqual(['welcome'])
    expect(canToggleCoupon(coupons, withReg, 'cat', false)).toBe(true)
    expect(nextCouponSelection(coupons, withLoyaltyAndReg, 'birthday', true).sort()).toEqual(
      ['birthday', 'loyalty'].sort()
    )
    expect(canToggleCoupon(coupons, new Set(['loyalty'] as const), 'birthday', true)).toBe(true)
  })

  it('lets a fixed HUF coupon sit beside one percentage coupon', () => {
    const listed = buildPromoCoupons({
      catClaimed: true,
      registrationClaimed: false,
      gamification: { code: 'NYAR2026-475D59', fixedHuf: 15_000 },
      labels: { ...labels, gamification: 'Ajándék kupon' },
    })
    const fixedId = gamificationCouponId('NYAR2026-475D59')
    expect(listed.find((c) => c.id === fixedId)?.fixedHuf).toBe(15_000)
    expect(canToggleCoupon(listed, new Set([fixedId]), 'cat', true)).toBe(true)
    expect(nextCouponSelection(listed, new Set([fixedId]), 'cat', true).sort()).toEqual(['cat', fixedId].sort())
    const stacked = calculateSelectedCouponPercent(listed, ['cat', fixedId])
    expect(stacked.finalPercent).toBeCloseTo(0.05)
    expect(stacked.gamificationFixedHuf).toBe(15_000)
    expect(stacked.hasFixedCoupon).toBe(true)
    expect(nextCouponSelection(listed, new Set(['cat', fixedId]), 'registration', true).sort()).toEqual(
      ['registration', fixedId].sort()
    )
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
    expect(canToggleCoupon(withHighCoupon, empty, gamificationCouponId('GLM-HIGH'), true)).toBe(true)
  })
})
