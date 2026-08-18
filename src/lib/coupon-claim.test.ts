import { describe, expect, it } from 'vitest'
import {
  interpretOwnedCoupon,
  isCampaignTemplate,
  personalClaimCode,
} from './coupon-claim'

describe('personalClaimCode', () => {
  it('keeps the campaign code readable and appends a unique suffix', () => {
    expect(personalClaimCode('NYAR2026', 'a1b2c3')).toBe('NYAR2026-A1B2C3')
    expect(personalClaimCode('  nyar-26 ', 'zz')).toBe('NYAR-26-ZZ')
  })
})

describe('interpretOwnedCoupon', () => {
  it('treats a spent personal coupon as used, otherwise as already claimed', () => {
    expect(interpretOwnedCoupon({ usedCount: 1, maxUses: 1 })).toBe('used')
    expect(interpretOwnedCoupon({ usedCount: 0, maxUses: 1 })).toBe('already_claimed')
    expect(interpretOwnedCoupon({ usedCount: 0, maxUses: null })).toBe('already_claimed')
  })
})

describe('isCampaignTemplate', () => {
  it('treats admin/global codes without an owner as claimable templates', () => {
    expect(isCampaignTemplate({ userId: null, source: 'admin' })).toBe(true)
    expect(isCampaignTemplate({ userId: null, source: null })).toBe(true)
    expect(isCampaignTemplate({ userId: 'u1', source: 'admin' })).toBe(false)
    expect(isCampaignTemplate({ userId: null, source: 'gamification' })).toBe(false)
  })
})
