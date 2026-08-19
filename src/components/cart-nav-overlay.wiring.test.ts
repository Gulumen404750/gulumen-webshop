import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('cart navigation overlay trap', () => {
  const header = readFileSync(join(process.cwd(), 'src/components/Header.tsx'), 'utf-8')
  const drawer = readFileSync(join(process.cwd(), 'src/components/CartDrawer.tsx'), 'utf-8')

  it('keeps the storefront header above the cart drawer', () => {
    expect(header).toMatch(/sticky top-0 z-\[200\]/)
    expect(drawer).toMatch(/top-14 sm:top-16/)
    expect(drawer).not.toMatch(/fixed inset-0 z-\[55\]/)
    expect(drawer).not.toMatch(/fixed top-0 right-0 bottom-0 z-\[60\]/)
  })

  it('sends mobile cart taps to the cart page instead of a full-screen drawer', () => {
    expect(header).toContain('href="/kosar"')
    expect(header).toContain('md:hidden')
    expect(header).toContain('hidden md:flex')
    expect(header).toContain('setCartDrawerOpen(true)')
  })

  it('closes the cart drawer on route change so it cannot trap navigation', () => {
    expect(header).toContain('setCartDrawerOpen(false)')
    expect(header).toMatch(/pathname, searchParams/)
  })
})
