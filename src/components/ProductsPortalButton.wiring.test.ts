import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('ProductsPortalButton wiring', () => {
  it('is mounted on the logged-in profile page', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/profil/page.tsx'), 'utf-8')
    expect(page).toMatch(/from ['"]@\/components\/ProductsPortalButton['"]/)
    expect(page).toMatch(/<ProductsPortalButton\s*\/>/)
  })

  it('opens a portal overlay then navigates to /termekek', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/ProductsPortalButton.tsx'), 'utf-8')
    expect(src).toMatch(/\/termekek/)
    expect(src).toMatch(/products-portal-overlay/)
    expect(src).toMatch(/prefers-reduced-motion/)
    expect(src).toMatch(/createPortal/)
  })
})
