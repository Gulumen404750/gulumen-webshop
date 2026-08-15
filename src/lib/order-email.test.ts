import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from './orders'

const getOrderById = vi.fn()
const getOrdersByGroupId = vi.fn()
const sendMail = vi.fn()

vi.mock('./orders', async () => {
  const actual = await vi.importActual<typeof import('./orders')>('./orders')
  return {
    ...actual,
    getOrderById: (...args: unknown[]) => getOrderById(...args),
    getOrdersByGroupId: (...args: unknown[]) => getOrdersByGroupId(...args),
  }
})

vi.mock('./mail', () => ({
  sendMail: (...args: unknown[]) => sendMail(...args),
}))

vi.mock('./prisma', () => ({
  isDbConfigured: () => false,
  prisma: {},
}))

import {
  getOrderSupportEmail,
  buildOrderChangeMailto,
  buildOrderGroupConfirmationHtml,
  buildOrderGroupConfirmationText,
  maybeSendOrderGroupConfirmationEmail,
  pickCustomerAddressOrder,
} from './order-email'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_test_1',
    status: 'paid',
    items: [
      {
        productId: 'prod_1',
        qty: 2,
        fulfillmentType: 'stock',
        priceHuf: 1500,
        name: 'Teszt termék',
      },
    ],
    subtotalHuf: 3000,
    discountHuf: 0,
    totalHuf: 3000,
    currency: 'huf',
    createdAt: new Date().toISOString(),
    orderType: 'in_stock',
    customerEmail: 'vasarlo@example.com',
    customerName: 'Kovács Anna',
    customerPhone: '+36301234567',
    shippingPostalCode: '1051',
    shippingCity: 'Budapest',
    shippingStreet: 'Váci utca',
    shippingHouseNumber: '12',
    billingSameAsShipping: true,
    ...overrides,
  }
}

describe('order confirmation email content', () => {
  it('includes order number, items, total, and addresses', () => {
    const order = makeOrder({
      billingSameAsShipping: false,
      billingPostalCode: '9021',
      billingCity: 'Győr',
      billingStreet: 'Baross út',
      billingHouseNumber: '5',
    })

    const html = buildOrderGroupConfirmationHtml([order], order.id)
    const text = buildOrderGroupConfirmationText([order], order.id)

    expect(html).toContain('Rendelésszám:')
    expect(html).toContain('ord_test_1')
    expect(html).toContain('Teszt termék')
    expect(html).toContain('Végösszeg:')
    expect(html).toContain('Szállítási cím')
    expect(html).toContain('Váci utca 12')
    expect(html).toContain('1051 Budapest')
    expect(html).toContain('Számlázási cím')
    expect(html).toContain('Baross út 5')
    expect(html).toContain('Győr')
    expect(html).toContain('Kérjük, ellenőrizd az adataidat!')

    expect(text).toContain('Rendelésszám: ord_test_1')
    expect(text).toContain('Teszt termék')
    expect(text).toContain('Végösszeg:')
    expect(text).toContain('Szállítási cím:')
    expect(text).toContain('Váci utca 12')
    expect(text).toContain('Számlázási cím:')
    expect(text).toContain('Baross út 5')
    expect(text).toContain('ellenőrizd az adataidat')
  })

  it('shows billing same as shipping when only shipping is set', () => {
    const html = buildOrderGroupConfirmationHtml([makeOrder()], 'ord_test_1')
    expect(html).toContain('Megegyezik a szállítási címmel')
  })

  it('includes mailto CTA for order changes before packing', () => {
    const order = makeOrder()
    const html = buildOrderGroupConfirmationHtml([order], order.id)
    const mailto = buildOrderChangeMailto(order.id)

    expect(mailto).toContain(`mailto:${getOrderSupportEmail()}`)
    expect(mailto).toContain(encodeURIComponent(`Rendelés módosítás – ${order.id}`))
    expect(html).toContain('Módosítás jelzése az oldalon')
    expect(html).toContain('/kapcsolat?rendeles=')
    expect(html).toContain(mailto)
    expect(html).toContain('/kapcsolat')
  })

  it('pickCustomerAddressOrder prefers order with address data', () => {
    const bare = makeOrder({
      id: 'ord_bare',
      customerName: undefined,
      shippingStreet: undefined,
      shippingCity: undefined,
      shippingPostalCode: undefined,
      shippingHouseNumber: undefined,
    })
    const withAddress = makeOrder({ id: 'ord_addr' })
    expect(pickCustomerAddressOrder([bare, withAddress]).id).toBe('ord_addr')
  })
})

describe('maybeSendOrderGroupConfirmationEmail payment gate', () => {
  beforeEach(() => {
    getOrderById.mockReset()
    getOrdersByGroupId.mockReset()
    sendMail.mockReset()
    sendMail.mockResolvedValue({ ok: true, id: 'email_1' })
  })

  it('does not send when trigger order is still payment_pending', async () => {
    getOrderById.mockResolvedValue(makeOrder({ status: 'payment_pending' }))
    const result = await maybeSendOrderGroupConfirmationEmail('ord_test_1')
    expect(result).toEqual({ ok: true })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('sends via Resend only after paid status with customer email', async () => {
    const order = makeOrder({
      id: `ord_paid_${Date.now()}`,
      status: 'paid',
      orderGroupId: undefined,
    })
    getOrderById.mockResolvedValue(order)
    const result = await maybeSendOrderGroupConfirmationEmail(order.id, order.customerEmail)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.sent).toBe(true)
    expect(sendMail).toHaveBeenCalled()
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'vasarlo@example.com',
        subject: `Rendelés megerősítés – ${order.id}`,
        replyTo: getOrderSupportEmail(),
      })
    )
    // Admin / postmaster másolat
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: getOrderSupportEmail(),
        subject: expect.stringContaining('[Gulumen] Új rendelés'),
      })
    )
    const payload = sendMail.mock.calls[0]![0] as { html: string; text: string }
    expect(payload.html).toContain('Szállítási cím')
    expect(payload.html).toContain('Kérjük, ellenőrizd az adataidat!')
    expect(payload.text).toContain('Váci utca 12')
  })
})
