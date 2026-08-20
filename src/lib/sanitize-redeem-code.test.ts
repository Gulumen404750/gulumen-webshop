import { describe, expect, it } from 'vitest'
import { sanitizeRedeemCode } from './sanitize-redeem-code'

describe('sanitizeRedeemCode', () => {
  it('uppercases typed codes and keeps real values', () => {
    expect(sanitizeRedeemCode('nyar2026')).toBe('NYAR2026')
    expect(sanitizeRedeemCode('abcd2345efgh')).toBe('ABCD2345EFGH')
  })

  it('clears empty input and the example placeholder copy', () => {
    expect(sanitizeRedeemCode('   ')).toBe('')
    expect(sanitizeRedeemCode('pl. NYAR2026 vagy ABCD2345EFGH', 'pl. NYAR2026 vagy ABCD2345EFGH')).toBe('')
    expect(
      sanitizeRedeemCode('e.g. NYAR2026 or ABCD2345EFGH', 'e.g. NYAR2026 or ABCD2345EFGH')
    ).toBe('')
  })
})
