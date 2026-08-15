/**
 * Nyilvános (auth nélküli) rendelés-nézet: PII és shipping-edit token kiszűrése.
 * Teljes adat csak a bejelentkezett tulajdonosnak.
 */
import type { Order } from '@/lib/orders'

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

/**
 * Auth nélküli válasz: nincs cím, telefon, e-mail, név, billing, token, belső fizetési ID.
 * Tulajdonosnak a teljes Order visszaadható.
 */
export function toPublicOrderView(order: Order, opts: { isOwner: boolean }): Order | PublicOrder {
  if (opts.isOwner) return order

  const out: Record<string, unknown> = {}
  for (const key of PUBLIC_ORDER_KEYS) {
    const value = order[key]
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
