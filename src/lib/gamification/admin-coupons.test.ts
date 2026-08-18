import { describe, expect, it } from 'vitest'
import {
  gamificationCouponAdminStatus,
  summarizeGamificationCouponStats,
} from './admin-coupons'

describe('gamificationCouponAdminStatus', () => {
  const now = new Date('2026-08-18T12:00:00.000Z')

  it('marks a live unused coupon as active', () => {
    expect(
      gamificationCouponAdminStatus(
        {
          active: true,
          usedCount: 0,
          maxUses: 1,
          validUntil: '2026-09-17T12:00:00.000Z',
        },
        now
      )
    ).toBe('active')
  })

  it('marks a spent coupon as used even if still active', () => {
    expect(
      gamificationCouponAdminStatus(
        { active: true, usedCount: 1, maxUses: 1, validUntil: '2026-09-17T12:00:00.000Z' },
        now
      )
    ).toBe('used')
  })

  it('marks past validUntil as expired before inactive', () => {
    expect(
      gamificationCouponAdminStatus(
        {
          active: true,
          usedCount: 0,
          maxUses: 1,
          validUntil: '2026-08-01T00:00:00.000Z',
        },
        now
      )
    ).toBe('expired')
  })

  it('marks deactivated unused coupons as inactive', () => {
    expect(
      gamificationCouponAdminStatus(
        { active: false, usedCount: 0, maxUses: 1, validUntil: '2026-09-17T12:00:00.000Z' },
        now
      )
    ).toBe('inactive')
  })
})

describe('summarizeGamificationCouponStats', () => {
  it('counts each status', () => {
    expect(
      summarizeGamificationCouponStats([
        { status: 'active' },
        { status: 'active' },
        { status: 'used' },
        { status: 'expired' },
      ])
    ).toEqual({ total: 4, active: 2, used: 1, expired: 1, inactive: 0 })
  })
})
