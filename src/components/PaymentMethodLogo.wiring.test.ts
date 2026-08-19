import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('PaymentMethodLogo', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/PaymentMethodLogo.tsx'), 'utf-8')

  it('renders official-looking brand marks for every checkout method', () => {
    expect(src).toMatch(/Visa, Mastercard/)
    expect(src).toMatch(/#1A1F71/)
    expect(src).toMatch(/#EB001B/)
    expect(src).toMatch(/#F79E1B/)

    expect(src).toMatch(/<title>PayPal<\/title>/)
    expect(src).toMatch(/#003087/)
    expect(src).toMatch(/#009CDE/)

    expect(src).toMatch(/<title>Apple Pay<\/title>/)
    expect(src).toMatch(/bg-black/)

    expect(src).toMatch(/<title>Google Pay<\/title>/)
    expect(src).toMatch(/#4285F4/)
    expect(src).toMatch(/#34A853/)
    expect(src).toMatch(/#FBBC05/)
    expect(src).toMatch(/#EA4335/)

    expect(src).toMatch(/<title>Klarna<\/title>/)
    expect(src).toMatch(/#FFB3C7/)
  })

  it('keeps logos compact so they fit the radio row', () => {
    expect(src).toMatch(/h-9 w-12/)
    expect(src).toMatch(/rounded-lg/)
  })
})
