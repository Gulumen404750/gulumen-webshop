import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import hu from '@/i18n/translations/hu.json'

describe('QR coupon scanner wiring', () => {
  const form = readFileSync(join(process.cwd(), 'src/components/GiftPointClaimForm.tsx'), 'utf-8')
  const modal = readFileSync(join(process.cwd(), 'src/components/QrCodeScannerModal.tsx'), 'utf-8')
  const csp = readFileSync(join(process.cwd(), 'src/lib/admin-security-headers.ts'), 'utf-8')

  it('places an icon scan button next to Aktiválás in the coupon box', () => {
    expect(form).toContain('QrCodeScannerModal')
    expect(form).toMatch(/from 'lucide-react'/)
    expect(form).toMatch(/QrCode/)
    expect(form).toContain("aria-label={t('giftClaim.scanAria')}")
    expect(form).toContain('flex items-center justify-between')
    expect(form).toContain('type="button"')
    expect(hu.giftClaim.scanAria).toBe('QR-kód beolvasása')
    expect(hu.giftClaim.submit).toBe('Aktiválás')
  })

  it('fills the redeem field from a scan and then activates', () => {
    expect(form).toContain('extractRedeemCodeFromScan')
    expect(form).toContain('setToken(extracted)')
    expect(form).toContain('void redeem(extracted)')
    expect(form).toContain("setError({ key: 'giftClaim.scanEmpty' })")
  })

  it('hides the scanner when the token comes from the claim URL', () => {
    expect(form).toMatch(/!hideTokenInput \? \(/)
    expect(form).toContain('QrCodeScannerModal')
  })

  it('opens a camera scanner with BarcodeDetector and jsQR fallback', () => {
    expect(modal).toContain('getUserMedia')
    expect(modal).toContain("facingMode: { ideal: 'environment' }")
    expect(modal).toContain('BarcodeDetector')
    expect(modal).toContain("import('jsqr')")
    expect(modal).toContain('playsInline')
    expect(modal).toContain("capture=\"environment\"")
    expect(modal).toContain("role=\"dialog\"")
  })

  it('allows same-origin camera for the storefront scanner', () => {
    expect(csp).toContain('camera=(self)')
    expect(csp).toContain("media-src 'self' blob:")
    expect(csp).not.toMatch(/camera=\(\),/)
  })
})
