import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('ProductsPortalButton wiring', () => {
  it('is mounted on the logged-in profile page', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/profil/page.tsx'), 'utf-8')
    expect(page).toMatch(/from ['"]@\/components\/ProductsPortalButton['"]/)
    expect(page).toMatch(/<ProductsPortalButton\s*\/>/)
  })

  it('navigates to /termekek without a portal overlay', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/ProductsPortalButton.tsx'), 'utf-8')
    expect(src).toMatch(/href=["']\/termekek["']/)
    expect(src).not.toMatch(/products-portal-overlay/)
    expect(src).not.toMatch(/createPortal/)
  })
})
