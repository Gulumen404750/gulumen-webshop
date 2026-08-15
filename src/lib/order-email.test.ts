import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from './orders'

const getOrderById = vi.fn()
const getOrdersByGroupId = vi.fn()
const ensureShippingEditToken = vi.fn()
const sendMail = vi.fn()

vi.mock('./orders', async () => {
  const actual = await vi.importActual<typeof import('./orders')>('./orders')
  return {
    ...actual,
    getOrderById: (...args: unknown[]) => getOrderById(...args),
    getOrdersByGroupId: (...args: unknown[]) => getOrdersByGroupId(...args),
    ensureShippingEditToken: (...args: unknown[]) => ensureShippingEditToken(...args),
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
  buildOrderGroupConfirmationHtml,
  buildOrderGroupConfirmationText,
  maybeSendOrderGroupConfirmationEmail,
  pickCustomerAddressOrder,
} from './order-email'
import { buildOrderShippingEditUrl } from './support-email'

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

  it('includes web CTA to tokenized shipping edit page (not contact form)', () => {
    const order = makeOrder({ shippingEditToken: 'tok_test_123' })
    const editUrl = buildOrderShippingEditUrl(order.id, { token: order.shippingEditToken })
    const html = buildOrderGroupConfirmationHtml([order], order.id, editUrl)
    const text = buildOrderGroupConfirmationText([order], order.id, editUrl)

    expect(html).toContain('Szállítási adatok módosítása')
    expect(html).toContain(editUrl)
    expect(html).toContain(`/rendelesek/${order.id}/modositas?t=tok_test_123`)
    expect(html).not.toContain('Módosítás jelzése')
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('/kapcsolat?rendeles=')
    expect(text).toContain('Szállítási adatok módosítása:')
    expect(text).toContain(editUrl)
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
    ensureShippingEditToken.mockReset()
    ensureShippingEditToken.mockImplementation(async (id: string) => `tok_for_${id}`)
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
    process.env.ADMIN_EMAIL = '1.dani@gmail.com'
    const order = makeOrder({
      id: `ord_paid_${Date.now()}`,
      status: 'paid',
      orderGroupId: undefined,
      shippingEditToken: 'tok_x',
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
        replyTo: 'postmaster@gulumen.com',
      })
    )
    // Admin másolat CSAK postmaster – soha 1.dani@gmail.com
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'postmaster@gulumen.com',
        subject: expect.stringContaining('[Gulumen] Új rendelés'),
      })
    )
    const adminCalls = sendMail.mock.calls.filter(
      (c) => (c[0] as { to?: string }).to === '1.dani@gmail.com'
    )
    expect(adminCalls).toHaveLength(0)
    const payload = sendMail.mock.calls[0]![0] as { html: string; text: string }
    expect(payload.html).toContain('Szállítási cím')
    expect(payload.html).toContain('Szállítási adatok módosítása')
    expect(payload.html).toContain('/rendelesek/')
    expect(payload.html).not.toContain('/kapcsolat?rendeles=')
    expect(payload.text).toContain('Váci utca 12')
  })
})
