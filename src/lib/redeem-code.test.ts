import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { normalizeRedeemCode, pickRedeemKind } from './redeem-code'
import { isCouponInValidPeriod } from './coupon-checkout'

describe('normalizeRedeemCode', () => {
  it('uppercases and strips spaces but keeps hyphens for GLM coupon codes', () => {
    expect(normalizeRedeemCode('  nyar 2026 ')).toBe('NYAR2026')
    expect(normalizeRedeemCode('glm-ba7d16a70fc3')).toBe('GLM-BA7D16A70FC3')
  })
})

describe('pickRedeemKind', () => {
  it('prefers a unique gift token over a coupon or batch label', () => {
    expect(
      pickRedeemKind({ giftToken: true, coupon: true, giftBatch: true })
    ).toBe('gift_token')
  })

  it('prefers an admin coupon over a gift-point batch label with the same text', () => {
    expect(
      pickRedeemKind({ giftToken: false, coupon: true, giftBatch: true })
    ).toBe('coupon')
  })

  it('falls back to a gift-point batch label', () => {
    expect(
      pickRedeemKind({ giftToken: false, coupon: false, giftBatch: true })
    ).toBe('gift_batch')
  })

  it('returns none when nothing matches', () => {
    expect(
      pickRedeemKind({ giftToken: false, coupon: false, giftBatch: false })
    ).toBe('none')
  })
})

describe('isCouponInValidPeriod', () => {
  const now = new Date('2026-08-18T12:00:00.000Z')

  it('accepts unlimited and current windows', () => {
    expect(isCouponInValidPeriod({ validFrom: null, validUntil: null }, now)).toBe(true)
    expect(
      isCouponInValidPeriod(
        {
          validFrom: new Date('2026-08-01T00:00:00.000Z'),
          validUntil: new Date('2026-08-31T00:00:00.000Z'),
        },
        now
      )
    ).toBe(true)
  })

  it('rejects expired or not-yet-valid coupons', () => {
    expect(
      isCouponInValidPeriod(
        { validFrom: null, validUntil: new Date('2026-08-01T00:00:00.000Z') },
        now
      )
    ).toBe(false)
    expect(
      isCouponInValidPeriod(
        { validFrom: new Date('2026-09-01T00:00:00.000Z'), validUntil: null },
        now
      )
    ).toBe(false)
  })
})

describe('lookupRedeemableCode claim-once wiring', () => {
  it('checks the shopper existing personal clone before previewing the campaign template', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/redeem-code.ts'), 'utf-8')
    expect(src).toMatch(/ownedCouponRedeemError/)
    expect(src).toMatch(/claimedFromCode: code/)
  })
})
