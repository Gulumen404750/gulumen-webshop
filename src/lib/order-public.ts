/**
 * Nyilvános (auth nélküli) rendelés-nézet: PII, shipping-edit token és belső SKU kiszűrése.
 * Teljes vevőadat csak a bejelentkezett tulajdonosnak; SKU / gyártási paraméterek soha.
 */
import type { Order, OrderItem } from '@/lib/orders'

/** Mezők, amiket a siker oldal / poller használ – biztonságosan kiadhatók. */
const PUBLIC_ORDER_KEYS = [
  'id',
  'status',
  'items',
  'subtotalHuf',
  'discountHuf',
  'totalHuf',
  'currency',
  'createdAt',
  'orderGroupId',
  'orderType',
  'amountPaid',
  'currencyPaid',
  'paidAt',
  'pointsDiscountHuf',
  'pointsUsed',
  'couponId',
  'appliedCoupons',
  'rewardsFinalized',
  'refundedAmount',
  'refundStatus',
  'cancelRequestedAt',
  'countedForLoyalty',
] as const satisfies ReadonlyArray<keyof Order>

export type PublicOrder = Pick<Order, (typeof PUBLIC_ORDER_KEYS)[number]>

function toCustomerOrderItems(items: OrderItem[]): OrderItem[] {
  return items.map((item) => ({
    productId: item.productId,
    qty: item.qty,
    fulfillmentType: item.fulfillmentType,
    priceHuf: item.priceHuf,
    name: item.name,
  }))
}

/**
 * Auth nélküli válasz: nincs cím, telefon, e-mail, név, billing, token, belső fizetési ID, SKU.
 * Tulajdonosnak a rendelés PII-vel, de SKU / gyártási paraméterek nélkül.
 */
export function toPublicOrderView(order: Order, opts: { isOwner: boolean }): Order | PublicOrder {
  const items = toCustomerOrderItems(order.items)
  if (opts.isOwner) {
    return { ...order, items }
  }

  const out: Record<string, unknown> = {}
  for (const key of PUBLIC_ORDER_KEYS) {
    const value = key === 'items' ? items : order[key]
    if (value !== undefined) out[key] = value
  }
  return out as PublicOrder
}

export function toPublicOrderViews(
  orders: Order[],
  opts: { isOwner: (order: Order) => boolean }
): Array<Order | PublicOrder> {
  return orders.map((order) => toPublicOrderView(order, { isOwner: opts.isOwner(order) }))
}
