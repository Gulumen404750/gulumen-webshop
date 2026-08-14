import { describe, expect, it } from 'vitest'
import {
  getAdminKeyMaxAgeDays,
  hashAdminApiKeyFingerprint,
  isAdminKeyExpired,
} from './admin-key-policy'

describe('hashAdminApiKeyFingerprint', () => {
  it('is stable and does not contain the raw key', () => {
    const a = hashAdminApiKeyFingerprint('secret-key')
    const b = hashAdminApiKeyFingerprint('secret-key')
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
    expect(a.includes('secret-key')).toBe(false)
    expect(hashAdminApiKeyFingerprint('other-key')).not.toBe(a)
  })
})

describe('getAdminKeyMaxAgeDays', () => {
  it('defaults to 90 days, 0 disables, invalid falls back', () => {
    expect(getAdminKeyMaxAgeDays({})).toBe(90)
    expect(getAdminKeyMaxAgeDays({ ADMIN_KEY_MAX_AGE_DAYS: '0' })).toBeNull()
    expect(getAdminKeyMaxAgeDays({ ADMIN_KEY_MAX_AGE_DAYS: '30' })).toBe(30)
    expect(getAdminKeyMaxAgeDays({ ADMIN_KEY_MAX_AGE_DAYS: 'nope' })).toBe(90)
  })
})

describe('isAdminKeyExpired', () => {
  it('expires after max age and ignores missing confirmation', () => {
    const now = new Date('2026-08-14T00:00:00Z')
    const old = new Date('2026-01-01T00:00:00Z')
    expect(isAdminKeyExpired(null, now, 90)).toBe(false)
    expect(isAdminKeyExpired(old, now, 90)).toBe(true)
    expect(isAdminKeyExpired(now, now, 90)).toBe(false)
    expect(isAdminKeyExpired(old, now, null)).toBe(false)
  })
})
