/**
 * Szállítási címke: gyártási tételek + QR-kód payload.
 * A címke szöveges része és a QR ugyanazt a strukturált adatot viszi.
 */

import { orderItemSpecForAdmin } from '@/lib/production-payload'

export type ShippingLabelProductionItem = {
  nev: string
  sku: string
  anyag: string
  szin: string
  darabszam: number
}

export type ShippingLabelQrPayload = {
  rendeles_azonosito: string
  tetelek: ShippingLabelProductionItem[]
}

export type ShippingLabelOrderItemInput = {
  name?: string | null
  productId?: string | null
  sku?: string | null
  qty: number
  parameters?: unknown
}

function dashIfEmpty(value: string): string {
  return value.trim() || '—'
}

export function shippingLabelItemsFromOrderItems(
  items: ShippingLabelOrderItemInput[]
): ShippingLabelProductionItem[] {
  return items.map((item) => {
    const spec = orderItemSpecForAdmin(item)
    const nev =
      spec.nev.trim() && spec.nev !== '—'
        ? spec.nev.trim()
        : item.productId?.trim() || '—'
    return {
      nev,
      sku: spec.sku.trim(),
      anyag: spec.anyag.trim(),
      szin: spec.szin.trim(),
      darabszam: spec.darabszam,
    }
  })
}

export function buildShippingLabelQrPayload(
  orderId: string,
  items: ShippingLabelProductionItem[]
): ShippingLabelQrPayload {
  return {
    rendeles_azonosito: orderId,
    tetelek: items.map((item) => ({
      nev: item.nev,
      sku: item.sku,
      anyag: item.anyag,
      szin: item.szin,
      darabszam: item.darabszam,
    })),
  }
}

/** Kompakt JSON – a QR-kód ezt kódolja. */
export function serializeShippingLabelQrPayload(payload: ShippingLabelQrPayload): string {
  return JSON.stringify(payload)
}

export function shippingLabelQrText(
  orderId: string,
  items: ShippingLabelProductionItem[]
): string {
  return serializeShippingLabelQrPayload(buildShippingLabelQrPayload(orderId, items))
}

export function formatShippingLabelItemLine(item: ShippingLabelProductionItem): string {
  return `- ${dashIfEmpty(item.nev)} | SKU: ${dashIfEmpty(item.sku)} | Anyag: ${dashIfEmpty(item.anyag)} | Szín: ${dashIfEmpty(item.szin)} | Darab: ${item.darabszam}`
}
