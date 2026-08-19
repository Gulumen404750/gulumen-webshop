import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('checkout coupon picker', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/fizetes/page.tsx'), 'utf-8')

  it('lists every active points coupon instead of only the first code', () => {
    expect(src).toMatch(/listActiveCheckoutCoupons/)
    expect(src).toMatch(/gamificationCoupons/)
    expect(src).toMatch(/wallet\?\.coupons/)
    expect(src).not.toMatch(/gamification: gamificationCoupon[^s]/)
  })

  it('does not promise purchase earn when the shopper is spending points', () => {
    expect(src).toMatch(/cashEarnHintPointsUsed/)
    expect(src).toMatch(/usePoints\s*\?\s*t\('payment.cashEarnHintPointsUsed'\)/)
  })

  it('does not promise purchase earn for Klarna instalments', () => {
    expect(src).toMatch(/cashEarnHintInstallment/)
    expect(src).toMatch(/paymentMethod === 'klarna'/)
  })

  it('keeps coupons selectable while spending points', () => {
    expect(src).toMatch(/selectedIds=\{selectedCouponIds\}/)
    expect(src).not.toMatch(/disabled=\{usePoints\}/)
    expect(src).not.toMatch(/setSelectedCouponIds\(\[\]\)/)
    expect(src).not.toMatch(/coupon: usePoints/)
    expect(src).toMatch(/welcomeOfferAccepted: couponSelection\.useWelcome/)
  })

  it('shows a remainder warning when a fixed coupon cannot be used in full', () => {
    expect(src).toMatch(/couponFixedRemainderWarning/)
    expect(src).toMatch(/fixedCouponUnusedHuf/)
    expect(src).toMatch(/showFixedRemainderWarning/)
    expect(src).toMatch(/text-red-600/)
    expect(src).toMatch(/couponCodes/)
  })
})
