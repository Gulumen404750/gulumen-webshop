/**
 * Vásárlói szállítási cím módosítás – szabályok és segédek.
 *
 * Szerkeszthető amíg:
 * - a rendelés fizetve / beszerzés alatt van
 * - nincs címkenyomtatás (printedAt) – admin még nem indította a feladást
 * - nincs lezárva (fulfilled / cancelled / …)
 */

import type { Order, OrderStatus } from './orders'

const EDITABLE_STATUSES = new Set<OrderStatus | string>(['paid', 'sourcing_pending'])

const LOCKED_STATUSES = new Set<OrderStatus | string>([
  'fulfilled',
  'cancelled',
  'failed',
  'expired',
  'sourcing_failed',
])

export type ShippingAddressFields = {
  customerName?: string | null
  customerPhone?: string | null
  shippingPostalCode?: string | null
  shippingCity?: string | null
  shippingStreet?: string | null
  shippingHouseNumber?: string | null
  deliveryNotes?: string | null
}

export function hasShippingAddressChanged(
  shippingAddressChangedAt: string | Date | null | undefined
): boolean {
  return shippingAddressChangedAt != null && shippingAddressChangedAt !== ''
}

export function canCustomerEditShippingAddress(order: {
  status: string
  printedAt?: string | Date | null
}): { ok: true } | { ok: false; reason: string } {
  if (LOCKED_STATUSES.has(order.status)) {
    return { ok: false, reason: 'A rendelés már lezárult, a cím nem módosítható.' }
  }
  if (order.printedAt) {
    return {
      ok: false,
      reason: 'A csomag feladása / címkenyomtatás már elindult, a cím nem módosítható.',
    }
  }
  if (!EDITABLE_STATUSES.has(order.status)) {
    return { ok: false, reason: 'Ebben a státuszban a szállítási cím nem módosítható.' }
  }
  return { ok: true }
}

export function shippingFieldsEqual(
  a: ShippingAddressFields,
  b: ShippingAddressFields
): boolean {
  const norm = (v: string | null | undefined) => (v?.trim() || '')
  return (
    norm(a.customerName) === norm(b.customerName) &&
    norm(a.customerPhone) === norm(b.customerPhone) &&
    norm(a.shippingPostalCode) === norm(b.shippingPostalCode) &&
    norm(a.shippingCity) === norm(b.shippingCity) &&
    norm(a.shippingStreet) === norm(b.shippingStreet) &&
    norm(a.shippingHouseNumber) === norm(b.shippingHouseNumber) &&
    norm(a.deliveryNotes) === norm(b.deliveryNotes)
  )
}

export function formatShippingOneLine(order: {
  customerName?: string | null
  customerPhone?: string | null
  shippingPostalCode?: string | null
  shippingCity?: string | null
  shippingStreet?: string | null
  shippingHouseNumber?: string | null
}): string {
  const street = [order.shippingStreet, order.shippingHouseNumber].filter(Boolean).join(' ')
  const city = [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(' ')
  return [order.customerName, street, city, order.customerPhone ? `Tel: ${order.customerPhone}` : null]
    .filter(Boolean)
    .join(', ')
}

/** Eredeti cím snapshot az Order mezőiből (ha van). */
export function getOriginalShippingFromOrder(order: Order): ShippingAddressFields | null {
  if (
    !order.originalShippingPostalCode &&
    !order.originalShippingCity &&
    !order.originalShippingStreet &&
    !order.originalShippingHouseNumber &&
    !order.originalCustomerName
  ) {
    return null
  }
  return {
    customerName: order.originalCustomerName ?? null,
    customerPhone: order.originalCustomerPhone ?? null,
    shippingPostalCode: order.originalShippingPostalCode ?? null,
    shippingCity: order.originalShippingCity ?? null,
    shippingStreet: order.originalShippingStreet ?? null,
    shippingHouseNumber: order.originalShippingHouseNumber ?? null,
  }
}
