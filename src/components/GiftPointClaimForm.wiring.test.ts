import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('gift / coupon redeem input wiring', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/GiftPointClaimForm.tsx'), 'utf-8')

  it('keeps the example text as a placeholder, not the input value', () => {
    expect(src).toContain("placeholder={t('giftClaim.codePlaceholder')}")
    expect(src).toMatch(/value=\{token\}/)
    expect(src).toMatch(/useState\(initialToken\)/)
    expect(src).not.toMatch(/value=\{t\(['"]giftClaim\.codePlaceholder['"]\)\}/)
    expect(src).not.toMatch(/useState\(t\(['"]giftClaim\.codePlaceholder['"]\)\)/)
    expect(src).not.toContain('NYAR2026')
  })

  it('styles the placeholder as muted helper text', () => {
    expect(src).toContain('placeholder:text-muted')
    expect(src).toContain('placeholder:font-sans')
  })
})
