import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('cart item mobile layout wiring', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf-8')
  const cartPage = readFileSync(join(process.cwd(), 'src/app/kosar/page.tsx'), 'utf-8')
  const drawer = readFileSync(join(process.cwd(), 'src/components/CartDrawer.tsx'), 'utf-8')

  it('uses a 2-row grid on mobile and 3 columns from sm breakpoint', () => {
    expect(css).toContain('grid-template-columns: auto minmax(0, 1fr);')
    expect(css).toContain("'image details'")
    expect(css).toContain("'actions actions'")
    expect(css).toContain('grid-template-columns: auto minmax(0, 1fr) auto;')
    expect(css).toContain("'image details actions'")
    expect(css).toContain('@media (min-width: 640px)')
  })

  it('keeps quantity controls from shrinking and overlapping text', () => {
    expect(css).toContain('.cart-item-card__qty')
    expect(css).toContain('flex-shrink: 0')
    expect(css).toContain('white-space: nowrap')
    expect(css).toContain('.cart-drawer-item')
    expect(css).toContain('.cart-drawer-item__body')
  })

  it('wires the cart page and drawer to the shared card layout', () => {
    expect(cartPage).toContain('className="cart-item-card ')
    expect(cartPage).toContain('cart-item-card__actions')
    expect(cartPage).toContain('cart-item-card__qty')
    expect(cartPage).not.toContain('className="flex gap-4 p-4 rounded-xl border')
    expect(drawer).toContain('className="cart-drawer-item ')
    expect(drawer).toContain('cart-drawer-item__body')
    expect(drawer).not.toContain('className="flex gap-3 p-3 rounded-lg border')
  })
})
