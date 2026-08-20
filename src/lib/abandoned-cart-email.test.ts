import { describe, expect, it } from 'vitest'
import { buildAbandonedCartOfferEmail, buildAbandonedCartReminderEmail } from './abandoned-cart-email'

const lines = [
  {
    productId: 'p1',
    qty: 2,
    name: 'Gulumen minta',
    unitPriceHuf: 12_000,
    lineTotalHuf: 24_000,
    image: 'https://gulumen.b-cdn.net/p1.jpg',
  },
]

describe('abandoned cart email', () => {
  it('uses the dark Gulumen template and restore deep link for offers', () => {
    const restoreUrl = 'https://gulumen.hu/kosar/visszaallitas?token=tok_test'
    const { html, subject } = buildAbandonedCartOfferEmail({
      greeting: 'Kedves Teszt!',
      percent: 15,
      couponCode: 'KOSAR-15-ABC',
      validUntilStr: '2026. szeptember 3.',
      lines,
      subtotalHuf: 24_000,
      restoreUrl,
      footerHtml: '',
    })
    expect(subject).toContain('15%')
    expect(html).toContain('#0b1220')
    expect(html).toContain('#38bdf8')
    expect(html).toContain('Gulumen minta')
    expect(html).toContain('https://gulumen.b-cdn.net/p1.jpg')
    expect(html).toContain(restoreUrl)
    expect(html).toContain('Kosár megnyitása és vásárlás')
    expect(html).toContain('automatikusan érvényesül')
    expect(html).not.toContain('A kupont a fizetésnél tudod megadni')
  })

  it('restores the cart from reminder emails too', () => {
    const restoreUrl = 'https://gulumen.hu/kosar/visszaallitas?token=remind'
    const { html } = buildAbandonedCartReminderEmail({
      greeting: 'Kedves Teszt!',
      lines,
      subtotalHuf: 24_000,
      restoreUrl,
      footerHtml: '',
    })
    expect(html).toContain(restoreUrl)
    expect(html).toContain('#111827')
  })
})
