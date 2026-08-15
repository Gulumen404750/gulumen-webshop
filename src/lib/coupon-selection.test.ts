import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildPromoCoupons,
  calculateSelectedCouponPercent,
  canToggleCoupon,
  MAX_COMBINED_COUPON_PERCENT,
} from '@/lib/coupon-selection'

const labels = {
  cat: 'Macska 5%',
  registration: 'Regisztráció 10%',
  loyalty: 'Hűség',
  welcome: 'Welcome 10%',
  birthday: 'Születésnap 15%',
}

describe('coupon selection + 20% cap', () => {
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

  it('allows cat + registration (15%) in launch stacking mode', () => {
    const result = calculateSelectedCouponPercent(coupons, ['cat', 'registration'])
    expect(result.finalPercent).toBeCloseTo(0.15)
    expect(result.capped).toBe(false)
    expect(result.useCat).toBe(true)
    expect(result.useRegistration).toBe(true)
  })

  it('caps birthday + registration (25% → 20%)', () => {
    const result = calculateSelectedCouponPercent(coupons, ['birthday', 'registration'])
    expect(result.rawPercent).toBeCloseTo(0.25)
    expect(result.finalPercent).toBeCloseTo(MAX_COMBINED_COUPON_PERCENT)
    expect(result.capped).toBe(true)
  })

  it('blocks toggle that would exceed 20%', () => {
    const selected = new Set(['birthday', 'registration'] as const)
    // already over if both selected via calculate; toggle adding cat to birthday+reg
    const withBirthday = new Set(['birthday'] as const)
    expect(canToggleCoupon(coupons, withBirthday, 'cat', true)).toBe(true) // 20%
    expect(canToggleCoupon(coupons, withBirthday, 'registration', true)).toBe(false) // 25%
    expect(canToggleCoupon(coupons, selected, 'cat', false)).toBe(true) // deselect always ok
  })

  it('allows toggling cat onto registration when stacking is enabled (default)', async () => {
    const withReg = new Set(['registration'] as const)
    expect(canToggleCoupon(coupons, withReg, 'cat', true)).toBe(true)
  })
})

describe('cat + registration stack flag off', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('ALLOW_CAT_REGISTRATION_STACK', '0')
    vi.stubEnv('NEXT_PUBLIC_ALLOW_CAT_REGISTRATION_STACK', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('blocks selecting cat together with registration', async () => {
    const { canToggleCoupon: canToggle, buildPromoCoupons: build } = await import(
      '@/lib/coupon-selection'
    )
    const { ALLOW_CAT_REGISTRATION_STACK: allow } = await import('@/lib/coupon-config')
    expect(allow).toBe(false)

    const coupons = build({
      catClaimed: true,
      registrationClaimed: true,
      labels,
    })
    const withReg = new Set(['registration'] as const)
    const withCat = new Set(['cat'] as const)
    expect(canToggle(coupons, withReg, 'cat', true)).toBe(false)
    expect(canToggle(coupons, withCat, 'registration', true)).toBe(false)
    expect(canToggle(coupons, withReg, 'cat', false)).toBe(true)
  })
})
