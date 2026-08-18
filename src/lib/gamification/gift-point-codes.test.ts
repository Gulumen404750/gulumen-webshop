import { describe, expect, it } from 'vitest'
import {
  buildGiftPointClaimPath,
  buildGiftPointClaimUrl,
  generateGiftPointToken,
  isGiftBatchInClaimWindow,
  normalizeGiftPointToken,
  previewStatusForCode,
} from './gift-point-codes'

describe('gift point codes', () => {
  it('normalizes tokens for URL / NFC / typed input', () => {
    expect(normalizeGiftPointToken(' ab-cd 12 ')).toBe('ABCD12')
    expect(normalizeGiftPointToken('xyz')).toBe('XYZ')
  })

  it('generates unique-looking uppercase tokens without ambiguous characters', () => {
    const token = generateGiftPointToken(12)
    expect(token).toHaveLength(12)
    expect(token).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
    const another = generateGiftPointToken(12)
    expect(another).not.toBe(token)
  })

  it('builds the public claim URL used by QR and NFC', () => {
    expect(buildGiftPointClaimPath('AbC123')).toBe('/claim/ABC123')
    expect(buildGiftPointClaimUrl('AbC123', 'https://gulumen.com')).toBe(
      'https://gulumen.com/claim/ABC123'
    )
  })

  it('rejects claims outside the batch window', () => {
    const now = new Date('2026-08-18T12:00:00.000Z')
    expect(
      isGiftBatchInClaimWindow({ active: false, validFrom: null, validUntil: null }, now)
    ).toBe('inactive')
    expect(
      isGiftBatchInClaimWindow(
        {
          active: true,
          validFrom: new Date('2026-09-01T00:00:00.000Z'),
          validUntil: null,
        },
        now
      )
    ).toBe('not_yet_valid')
    expect(
      isGiftBatchInClaimWindow(
        {
          active: true,
          validFrom: null,
          validUntil: new Date('2026-08-01T00:00:00.000Z'),
        },
        now
      )
    ).toBe('expired')
    expect(
      isGiftBatchInClaimWindow({ active: true, validFrom: null, validUntil: null }, now)
    ).toBe('available')
  })

  it('marks claimed codes as used even if the batch is still active', () => {
    const now = new Date('2026-08-18T12:00:00.000Z')
    expect(
      previewStatusForCode(
        {
          active: true,
          claimedAt: new Date('2026-08-18T11:00:00.000Z'),
          batch: { active: true, validFrom: null, validUntil: null },
        },
        now
      )
    ).toBe('used')
  })
})
