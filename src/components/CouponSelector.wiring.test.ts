import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('CouponSelector fixed vs percent display', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/CouponSelector.tsx'), 'utf-8')

  it('never renders a −0% badge for a selected coupon', () => {
    expect(src).toMatch(/coupon\.percent > 0/)
    expect(src).not.toMatch(/!isFixed && \(\s*<span[\s\S]*Math\.round\(coupon\.percent \* 100\)%/)
  })

  it('shows the forint amount for a fixed coupon and in the selected summary', () => {
    expect(src).toContain('selectedFixedHuf')
    expect(src).toContain('money(coupon.fixedHuf')
    expect(src).toContain('selectedFixedHuf > 0 ? money(selectedFixedHuf)')
    expect(src).toMatch(/percentDisplay > 0 \|\| selectedFixedHuf > 0/)
  })

  it('shows an exclusive-discount hint when the selector is disabled', () => {
    expect(src).toContain('exclusiveHint')
    expect(src).toContain('disabled={disabled || cannotSelect}')
  })
})
