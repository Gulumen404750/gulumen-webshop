import { describe, expect, it } from 'vitest'

/** Mirror of success-page cart-clear status rules for unit coverage. */
const CART_CLEAR_STATUSES = new Set([
  'paid',
  'fulfilled',
  'sourcing_pending',
  'payment_pending',
])

function shouldClearCartForOrders(orders: { status: string }[]): boolean {
  if (!orders.length) return false
  const allFailed = orders.every((o) => o.status === 'cancelled' || o.status === 'sourcing_failed')
  if (allFailed) return false
  return orders.some((o) => CART_CLEAR_STATUSES.has(o.status))
}

describe('shouldClearCartForOrders', () => {
  it('clears for paid stock order', () => {
    expect(shouldClearCartForOrders([{ status: 'paid' }])).toBe(true)
  })

  it('clears for sourcing_pending (authorize success)', () => {
    expect(shouldClearCartForOrders([{ status: 'sourcing_pending' }])).toBe(true)
  })

  it('clears for payment_pending (Dummy / webhook lag on success page)', () => {
    expect(shouldClearCartForOrders([{ status: 'payment_pending' }])).toBe(true)
  })

  it('clears mixed stock paid + sourcing pending', () => {
    expect(
      shouldClearCartForOrders([{ status: 'paid' }, { status: 'sourcing_pending' }])
    ).toBe(true)
  })

  it('does not clear when all cancelled/failed', () => {
    expect(
      shouldClearCartForOrders([{ status: 'cancelled' }, { status: 'sourcing_failed' }])
    ).toBe(false)
  })

  it('does not clear empty list', () => {
    expect(shouldClearCartForOrders([])).toBe(false)
  })
})
