import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('cart navigation overlay trap', () => {
  const header = readFileSync(join(process.cwd(), 'src/components/Header.tsx'), 'utf-8')
  const drawer = readFileSync(join(process.cwd(), 'src/components/CartDrawer.tsx'), 'utf-8')
  const cartPage = readFileSync(join(process.cwd(), 'src/app/kosar/page.tsx'), 'utf-8')
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf-8')
  const dealPopup = readFileSync(join(process.cwd(), 'src/components/DealPopup.tsx'), 'utf-8')

  it('keeps a fixed storefront header above cart overlays', () => {
    expect(css).toMatch(/--site-header-height:\s*3\.5rem/)
    expect(header).toMatch(/fixed top-0 inset-x-0 z-\[300\]/)
    expect(header).toMatch(/pointer-events-auto/)
    expect(header).toMatch(/h-14 sm:h-16 shrink-0/)
    expect(drawer).toMatch(/top-\[var\(--site-header-height\)\]/)
    expect(drawer).not.toMatch(/fixed inset-0 z-\[55\]/)
    expect(drawer).not.toMatch(/fixed top-0 right-0 bottom-0 z-\[60\]/)
  })

  it('sends mobile cart taps to the cart page instead of a full-screen drawer', () => {
    expect(header).toContain('href="/kosar"')
    expect(header).toContain('md:hidden')
    expect(header).toContain('hidden md:flex')
    expect(header).toContain('setCartDrawerOpen(true)')
    expect(header).toContain('replace={onCartPage}')
  })

  it('closes the cart drawer on route change so it cannot trap navigation', () => {
    expect(header).toContain('setCartDrawerOpen(false)')
    expect(header).toMatch(/pathname, searchParams/)
    expect(header).toContain('cartDrawerOpen && !onCartPage')
    expect(drawer).toContain("pathname === '/kosar'")
    expect(drawer).toContain('if (!isOpen || onCartPage) return null')
  })

  it('strips ?add= without pushing a new history entry', () => {
    expect(cartPage).toContain('window.history.replaceState')
    expect(cartPage).toContain('stripCartAddQuery')
    expect(cartPage).not.toMatch(/router\.replace\('\/kosar'\)/)
  })

  it('does not cover the cart page with the deal popup overlay', () => {
    expect(dealPopup).toContain("pathname === '/kosar'")
  })
})
