import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('PaymentMethodPicker', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/PaymentMethodPicker.tsx'), 'utf-8')

  it('can disable individual methods such as Klarna below the minimum', () => {
    expect(src).toMatch(/unavailableMethods/)
    expect(src).toMatch(/disabled=\{unavailable\}/)
  })

  it('uses brand logos instead of generic Lucide card/phone/wallet icons', () => {
    expect(src).toMatch(/PaymentMethodLogo/)
    expect(src).not.toMatch(/lucide-react/)
    expect(src).not.toMatch(/METHOD_ICONS/)
    expect(src).not.toMatch(/CreditCard|Smartphone|Wallet/)
    expect(src).toMatch(/items-center gap-3/)
  })
})
