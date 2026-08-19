import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import hu from '@/i18n/translations/hu.json'

describe('gift / coupon redeem input wiring', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/GiftPointClaimForm.tsx'), 'utf-8')

  it('keeps a generic placeholder, not a campaign-code example', () => {
    expect(src).toContain("placeholder={t('giftClaim.codePlaceholder')}")
    expect(src).toMatch(/value=\{token\}/)
    expect(src).toMatch(/useState\(initialToken\)/)
    expect(src).not.toMatch(/value=\{t\(['"]giftClaim\.codePlaceholder['"]\)\}/)
    expect(src).not.toMatch(/useState\(t\(['"]giftClaim\.codePlaceholder['"]\)\)/)
    expect(src).not.toContain('NYAR2026')
    expect(hu.giftClaim.codePlaceholder).not.toMatch(/NYAR2026|ABCD2345EFGH/)
    expect(hu.giftClaim.codePlaceholder).toBe('Kód megadása')
  })

  it('styles the placeholder as muted helper text', () => {
    expect(src).toContain('placeholder:text-muted')
    expect(src).toContain('placeholder:font-sans')
  })
})

describe('GiftPointClaimForm help UI', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/GiftPointClaimForm.tsx'), 'utf-8')

  it('keeps the redeem box title short and moves rules behind a help control', () => {
    expect(hu.giftClaim.title).toBe('Kupon')
    expect(src).toMatch(/giftClaim\.title/)
    expect(src).toMatch(/CircleHelp/)
    expect(src).toMatch(/giftClaim\.helpAria/)
    expect(src).toMatch(/giftClaim\.hint/)
    expect(src).toMatch(/role="dialog"/)
    expect(src).toMatch(/aria-modal="true"/)
    expect(src).not.toMatch(/<p className="text-sm text-muted mt-1">\{t\('giftClaim\.hint'/)
  })
})
