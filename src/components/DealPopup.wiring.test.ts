import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * DealPopup storefront bekötés – a komponens a root layoutban mountolódik,
 * és csak akkor jelenik meg, ha az admin config enabled + van termék.
 */
describe('DealPopup wiring', () => {
  it('is mounted from the root layout', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf-8')
    expect(layout).toMatch(/from ['"]@\/components\/DealPopup['"]/)
    expect(layout).toMatch(/<DealPopup\s*\/>/)
  })

  it('gates visibility on config.enabled and products', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/DealPopup.tsx'), 'utf-8')
    expect(src).toMatch(/config\?\.enabled/)
    expect(src).toMatch(/products\.length > 0/)
    expect(src).toMatch(/\/api\/deal-popup/)
  })
})
