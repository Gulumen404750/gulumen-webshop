import { describe, expect, it } from 'vitest'
import { buildSuspiciousLoginAlertEmail, redactEmail } from './login-alert-email'

describe('login alert email', () => {
  it('redacts the local part of an email', () => {
    expect(redactEmail('buyer@example.com')).toBe('b***@example.com')
    expect(redactEmail('  Ada@Shop.HU ')).toBe('a***@shop.hu')
  })

  it('builds a lockout alert without the raw customer email', () => {
    const lockedUntil = new Date('2026-08-14T18:00:00.000Z')
    const mail = buildSuspiciousLoginAlertEmail({
      kind: 'user',
      email: 'buyer@example.com',
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
      failedCount: 10,
      lockedUntil,
    })
    expect(mail.subject).toContain('Gyanús belépés')
    expect(mail.text).toContain('b***@example.com')
    expect(mail.text).not.toContain('buyer@example.com')
    expect(mail.html).toContain('203.0.113.10')
    expect(mail.html).toContain('2026-08-14T18:00:00.000Z')
  })

  it('labels admin lockouts without a customer email', () => {
    const mail = buildSuspiciousLoginAlertEmail({
      kind: 'admin',
      ip: '198.51.100.1',
      failedCount: 5,
      lockedUntil: new Date('2026-08-14T18:00:00.000Z'),
    })
    expect(mail.subject).toContain('admin')
    expect(mail.text).toContain('Admin belépés')
  })
})
