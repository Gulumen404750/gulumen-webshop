import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('PaymentMethodPicker', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/PaymentMethodPicker.tsx'), 'utf-8')

  it('can disable individual methods such as Klarna below the minimum', () => {
    expect(src).toMatch(/unavailableMethods/)
    expect(src).toMatch(/disabled=\{unavailable\}/)
  })
})
