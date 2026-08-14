import { describe, expect, it } from 'vitest'
import {
  buildAdminResetEmailHtml,
  buildAdminResetEmailText,
  buildAdminResetUrl,
  createAdminResetToken,
  hashAdminResetToken,
  isAdminResetTokenExpired,
  resetTokenMatches,
} from './admin-password-reset'

describe('admin password reset token', () => {
  it('stores a SHA-256 hash, not the raw token', () => {
    const token = createAdminResetToken(new Date('2026-08-14T12:00:00.000Z'))
    expect(token.raw).toHaveLength(43)
    expect(token.hash).toBe(hashAdminResetToken(token.raw))
    expect(token.hash).not.toBe(token.raw)
    expect(token.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(token.expiresAt.toISOString()).toBe('2026-08-14T12:15:00.000Z')
  })

  it('expires after the TTL', () => {
    const now = new Date('2026-08-14T12:00:00.000Z')
    const token = createAdminResetToken(now, 15 * 60 * 1000)
    expect(isAdminResetTokenExpired(token.expiresAt, now)).toBe(false)
    expect(isAdminResetTokenExpired(token.expiresAt, new Date(now.getTime() + 15 * 60 * 1000))).toBe(
      true
    )
    expect(isAdminResetTokenExpired(null)).toBe(true)
  })

  it('compares hashes in a length-safe way', () => {
    const token = createAdminResetToken()
    expect(resetTokenMatches(token.raw, token.hash)).toBe(true)
    expect(resetTokenMatches('other-token', token.hash)).toBe(false)
    expect(resetTokenMatches(token.raw, null)).toBe(false)
  })

  it('builds the reset URL with the raw token as a query param', () => {
    expect(buildAdminResetUrl('abc_token', 'https://www.gulumen.com', null)).toBe(
      'https://www.gulumen.com/admin/reset?token=abc_token'
    )
    expect(buildAdminResetUrl('abc_token', 'https://www.gulumen.com', 'desk-a1b2c3d4')).toBe(
      'https://www.gulumen.com/desk-a1b2c3d4/reset?token=abc_token'
    )
  })

  it('never puts the raw ADMIN_API_KEY into the email body', () => {
    const html = buildAdminResetEmailHtml('https://www.gulumen.com/admin/reset?token=abc')
    const text = buildAdminResetEmailText('https://www.gulumen.com/admin/reset?token=abc')
    expect(html).not.toMatch(/ADMIN_API_KEY\s*=/)
    expect(html.toLowerCase()).not.toContain('sk_')
    expect(text).toContain('API kulcs nincs ebben a levélben')
    expect(html).toContain('soha nem küldjük')
  })
})
