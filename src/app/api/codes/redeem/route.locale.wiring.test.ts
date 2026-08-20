import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('redeem API locale-neutral errors', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/api/codes/redeem/route.ts'), 'utf-8')

  it('does not return Hungarian coupon copy that would freeze the storefront language', () => {
    expect(src).not.toContain('Ez a kupon már aktiválva van a fiókodon.')
    expect(src).not.toContain('Ez a kupon jelenleg nem aktív.')
    expect(src).not.toContain('Ez a kupon nem ehhez a fiókhoz tartozik.')
  })

  it('keeps machine-readable coupon error codes for client i18n', () => {
    expect(src).toContain("case 'coupon_already_claimed'")
    expect(src).toMatch(/mapCouponError\(claimed\.code, claimed\.error\)/)
  })
})
