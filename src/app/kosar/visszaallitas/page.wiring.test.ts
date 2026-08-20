import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('abandoned cart restore page', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/kosar/visszaallitas/page.tsx'), 'utf-8')

  it('loads the tokenized cart and auto-applies the offer coupon', () => {
    expect(src).toMatch(/\/api\/cart\/restore\?token=/)
    expect(src).toMatch(/replaceItems/)
    expect(src).toMatch(/writeTypedCoupon/)
    expect(src).toMatch(/abandoned_cart/)
    expect(src).toMatch(/router\.replace\('\/kosar'\)/)
  })
})
