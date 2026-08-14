import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('ambient atmosphere wiring', () => {
  it('is mounted from the root layout inside ThemeProvider', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf-8')
    expect(layout).toMatch(/from ['"]@\/components\/AmbientAtmosphere['"]/)
    expect(layout).toMatch(/<AmbientAtmosphere\s*\/>/)
    expect(layout).toMatch(/<ThemeProvider>/)
    expect(layout).toMatch(/relative isolate/)
  })

  it('uses GPU transforms, will-change, and skips admin plus reduced motion', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/AmbientAtmosphere.tsx'), 'utf-8')
    expect(src).toMatch(/prefers-reduced-motion/)
    expect(src).toMatch(/pointer: fine/)
    expect(src).toMatch(/hover: hover/)
    expect(src).toMatch(/startsWith\('\/admin'\)/)
    expect(src).toMatch(/\/termekek/)
    expect(src).toMatch(/requestAnimationFrame/)
    expect(src).toMatch(/translate3d/)
    expect(src).toMatch(/ambient-orb/)
    expect(src).toMatch(/cursor-glow/)
    expect(src).toMatch(/aria-hidden/)
  })

  it('defines ambient, glow, and staggered card animations in CSS', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf-8')
    expect(css).toMatch(/\.ambient-atmosphere/)
    expect(css).toMatch(/will-change:\s*transform/)
    expect(css).toMatch(/translate3d/)
    expect(css).toMatch(/\.cursor-glow/)
    expect(css).toMatch(/\.product-stagger-item/)
    expect(css).toMatch(/@keyframes product-stagger-in/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/)
  })

  it('replays product stagger when the shop category changes', () => {
    const shop = readFileSync(join(process.cwd(), 'src/components/ShopContent.tsx'), 'utf-8')
    expect(shop).toMatch(/key=\{`\$\{categoryParam\}\|\$\{subParam\}`\}/)
    expect(shop).toMatch(/ProductStaggerItem/)
  })
})
