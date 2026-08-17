import { describe, expect, it } from 'vitest'
import { toPublicOrderView } from './order-public'
import type { Order } from './orders'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_1',
    status: 'paid',
    items: [{ productId: 'p1', name: 'Teszt', qty: 1, priceHuf: 1000, fulfillmentType: 'stock' }],
    subtotalHuf: 1000,
    discountHuf: 0,
    totalHuf: 1000,
    currency: 'HUF',
    createdAt: '2026-01-01T00:00:00.000Z',
    orderGroupId: 'grp_1',
    orderType: 'in_stock',
    customerEmail: 'secret@example.com',
    customerName: 'Titkos Név',
    customerPhone: '+36301234567',
    shippingPostalCode: '1011',
    shippingCity: 'Budapest',
    shippingStreet: 'Fő utca',
    shippingHouseNumber: '1',
    shippingEditToken: 'super-secret-token',
    userId: 'user_1',
    pointsUsed: 10,
    ...overrides,
  }
}

describe('toPublicOrderView', () => {
  it('strips PII and shippingEditToken for anonymous viewers', () => {
    const view = toPublicOrderView(makeOrder(), { isOwner: false })
    expect(view.id).toBe('ord_1')
    expect(view.status).toBe('paid')
    expect(view.totalHuf).toBe(1000)
    expect(view.pointsUsed).toBe(10)
    expect(view).not.toHaveProperty('shippingEditToken')
    expect(view).not.toHaveProperty('customerPhone')
    expect(view).not.toHaveProperty('customerEmail')
    expect(view).not.toHaveProperty('shippingStreet')
    expect(view).not.toHaveProperty('shippingCity')
    expect(view).not.toHaveProperty('userId')
  })

  it('returns full order for the owner', () => {
    const order = makeOrder()
    const view = toPublicOrderView(order, { isOwner: true })
    expect(view).toEqual(order)
    expect((view as Order).shippingEditToken).toBe('super-secret-token')
    expect((view as Order).customerPhone).toBe('+36301234567')
  })

  it('strips internal SKU and production parameters from customer-facing items', () => {
    const order = makeOrder({
      items: [
        {
          productId: 'p1',
          name: 'Teszt',
          qty: 2,
          priceHuf: 1000,
          fulfillmentType: 'stock',
          sku: 'GUL-0000001454',
          parameters: { colorName: 'Piros', colorHex: '#ff0000' },
        },
      ],
    })
    const ownerView = toPublicOrderView(order, { isOwner: true }) as Order
    const publicView = toPublicOrderView(order, { isOwner: false })
    expect(ownerView.items[0]).toEqual({
      productId: 'p1',
      name: 'Teszt',
      qty: 2,
      priceHuf: 1000,
      fulfillmentType: 'stock',
    })
    expect(ownerView.items[0]).not.toHaveProperty('sku')
    expect((publicView as { items: unknown[] }).items[0]).not.toHaveProperty('sku')
    expect((publicView as { items: unknown[] }).items[0]).not.toHaveProperty('parameters')
  })
})
