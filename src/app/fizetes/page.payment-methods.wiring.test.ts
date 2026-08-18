import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('checkout payment method picker', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/fizetes/page.tsx'), 'utf-8')

  it('sends the selected payment method and locale to checkout', () => {
    expect(src).toMatch(/PaymentMethodPicker/)
    expect(src).toMatch(/paymentMethod/)
    expect(src).toMatch(/locale/)
    expect(src).toMatch(/payWithPaypal/)
    expect(src).toMatch(/payWithKlarna/)
    expect(src).toMatch(/methodKlarnaNote/)
  })

  it('keeps points vs coupon stacking independent of the new payment methods', () => {
    expect(src).toMatch(/usePoints\s*\?\s*t\('payment.cashEarnHintPointsUsed'\)/)
    expect(src).toMatch(/usePoints \? \[\] : selectedCouponIds/)
    expect(src).toMatch(/disabled=\{usePoints\}/)
  })

  it('does not promise purchase earn on Klarna instalments', () => {
    expect(src).toMatch(/cashEarnHintInstallment/)
    expect(src).toMatch(/paymentMethod === 'klarna'/)
  })

  it('disables Klarna below the 35 000 Ft payable minimum', () => {
    expect(src).toMatch(/isKlarnaEligible/)
    expect(src).toMatch(/KLARNA_MIN_AMOUNT_HUF/)
    expect(src).toMatch(/unavailableMethods=\{klarnaEligible \? \[\] : \['klarna'\]\}/)
    expect(src).toMatch(/methodKlarnaMinHint/)
    expect(src).toMatch(/errorKlarnaMinAmount/)
  })
})
