import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('LoyaltyTierBadge ranks', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/LoyaltyTierBadge.tsx'), 'utf-8')
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf-8')

  it('shows a mystery starter badge and Réz–Gyémánt ranks with a pulse', () => {
    expect(src).toContain("displayTier === 'mystery'")
    expect(src).toContain('HelpCircle')
    expect(src).toContain('Trophy')
    expect(src).toContain('loyalty-badge-pulse')
    expect(src).toContain('LOYALTY_DISPLAY_TIERS')
    expect(src).toContain('tierLabelKey')
    expect(src).toContain('loyaltyRanksLabel')
    expect(css).toContain('.loyalty-badge-pulse')
    expect(css).toContain('prefers-reduced-motion')
  })
})
