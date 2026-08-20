import { describe, expect, it } from 'vitest'
import { extractRedeemCodeFromScan } from './scan-redeem-code'

describe('extractRedeemCodeFromScan', () => {
  it('pulls the token from a gift-point claim URL', () => {
    expect(extractRedeemCodeFromScan('https://www.gulumen.com/claim/AbC123xyz')).toBe('ABC123XYZ')
    expect(extractRedeemCodeFromScan('https://gulumen.com/claim/GLMTOKEN12?x=1')).toBe('GLMTOKEN12')
    expect(extractRedeemCodeFromScan('/claim/nYar2026')).toBe('NYAR2026')
  })

  it('keeps a pasted coupon code and strips surrounding whitespace', () => {
    expect(extractRedeemCodeFromScan('  glm-ba7d16a70fc3  ')).toBe('GLM-BA7D16A70FC3')
    expect(extractRedeemCodeFromScan('nyar 2026')).toBe('NYAR2026')
  })

  it('uses the last path segment of a non-claim URL', () => {
    expect(extractRedeemCodeFromScan('https://example.com/c/SAVE15')).toBe('SAVE15')
  })

  it('returns empty for blank payloads', () => {
    expect(extractRedeemCodeFromScan('   ')).toBe('')
    expect(extractRedeemCodeFromScan('')).toBe('')
  })
})
