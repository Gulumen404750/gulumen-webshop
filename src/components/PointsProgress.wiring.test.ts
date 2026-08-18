import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('PointsProgress profile coupons', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/PointsProgress.tsx'), 'utf-8')

  it('lets the shopper open a list of purchased coupons under redeem', () => {
    expect(src).toMatch(/<details/)
    expect(src).toMatch(/gamification\.myCouponsTitle/)
    expect(src).toMatch(/wallet\?\.coupons/)
  })

  it('overlays a scrollable coupon list so the profile grid does not jump', () => {
    expect(src).toMatch(/absolute left-0 right-0 top-full/)
    expect(src).toMatch(/max-h-56 overflow-y-auto/)
  })

  it('does not hide the redeem button just because a coupon is already unused', () => {
    expect(src).toMatch(/wallet\?\.canRedeem/)
    expect(src).not.toMatch(/canRedeem && !wallet\?\.hasActiveCoupon/)
    expect(src).not.toMatch(/remaining > 0 && !wallet\?\.hasActiveCoupon/)
  })
})
