import { describe, expect, it } from 'vitest'
import {
  buildTotpAuthUrl,
  generateTotpCode,
  generateTotpSecret,
  normalizeTotpCode,
  totpQrDataUrl,
  verifyTotpCode,
} from './admin-totp'

describe('normalizeTotpCode', () => {
  it('accepts 6 digits and strips spaces', () => {
    expect(normalizeTotpCode('123456')).toBe('123456')
    expect(normalizeTotpCode('123 456')).toBe('123456')
    expect(normalizeTotpCode('12a456')).toBe(null)
    expect(normalizeTotpCode('12345')).toBe(null)
    expect(normalizeTotpCode(123456)).toBe(null)
  })
})

describe('TOTP generate / verify', () => {
  it('verifies a freshly generated Google Authenticator code', async () => {
    const secret = generateTotpSecret()
    expect(secret.length).toBeGreaterThan(8)
    const token = await generateTotpCode(secret)
    expect(token).toMatch(/^\d{6}$/)
    expect(await verifyTotpCode(secret, token)).toBe(true)
    expect(await verifyTotpCode(secret, '000000')).toBe(false)
  })

  it('builds an otpauth URI and a PNG QR data URL', async () => {
    const secret = generateTotpSecret()
    const uri = buildTotpAuthUrl(secret)
    expect(uri.startsWith('otpauth://totp/')).toBe(true)
    expect(uri).toContain('Gulumen')
    expect(uri).toContain('secret=')
    const qr = await totpQrDataUrl(uri)
    expect(qr.startsWith('data:image/png;base64,')).toBe(true)
  })
})
