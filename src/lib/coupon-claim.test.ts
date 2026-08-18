import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  campaignTemplateBlocksNewClaim,
  interpretOwnedCoupon,
  isCampaignTemplate,
  isUsageAutoDisabled,
  ownedCouponRedeemError,
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

describe('campaignTemplateBlocksNewClaim', () => {
  const now = new Date('2026-08-18T12:00:00.000Z')
  const template = {
    userId: null as string | null,
    active: true,
    usedCount: 0,
    maxUses: 1 as number | null,
    validFrom: null as Date | null,
    validUntil: null as Date | null,
  }

  it('lets every shopper claim NYAR2026 even if the template looks globally used', () => {
    expect(
      campaignTemplateBlocksNewClaim({ ...template, usedCount: 1, maxUses: 1 }, now)
    ).toBeNull()
    expect(
      campaignTemplateBlocksNewClaim(
        { ...template, active: false, usedCount: 1, maxUses: 1 },
        now
      )
    ).toBeNull()
  })

  it('still blocks an admin-disabled campaign that was not auto-exhausted', () => {
    expect(
      campaignTemplateBlocksNewClaim(
        { ...template, active: false, usedCount: 0, maxUses: 100 },
        now
      )
    ).toBe('coupon_inactive')
  })

  it('blocks expired campaign templates for new claims', () => {
    expect(
      campaignTemplateBlocksNewClaim(
        { ...template, validUntil: new Date('2026-08-01T00:00:00.000Z') },
        now
      )
    ).toBe('coupon_expired')
  })
})

describe('isUsageAutoDisabled', () => {
  it('detects a template that was turned off only because global uses ran out', () => {
    expect(isUsageAutoDisabled({ active: false, usedCount: 1, maxUses: 1 })).toBe(true)
    expect(isUsageAutoDisabled({ active: false, usedCount: 0, maxUses: 1 })).toBe(false)
    expect(isUsageAutoDisabled({ active: true, usedCount: 1, maxUses: 1 })).toBe(false)
  })
})

describe('ownedCouponRedeemError', () => {
  it('returns used vs already claimed so the profile form cannot re-activate', () => {
    expect(ownedCouponRedeemError({ usedCount: 1, maxUses: 1 }).code).toBe('coupon_used')
    expect(ownedCouponRedeemError({ usedCount: 0, maxUses: 1 }).code).toBe(
      'coupon_already_claimed'
    )
  })
})

describe('claimCouponForUser template handling', () => {
  it('clones the campaign code for the shopper without consuming the global template', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/coupon-claim.ts'), 'utf-8')
    expect(src).toMatch(/type ClaimTxOutcome/)
    expect(src).toMatch(/claimedFromCode: template.code/)
    expect(src).toMatch(/source: ADMIN_CLAIM_SOURCE/)
    expect(src).not.toMatch(/usedCount: newUsed/)
    expect(src).not.toMatch(/template.usedCount \+ 1/)
  })
})
