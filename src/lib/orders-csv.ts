/**
 * Admin rendelés-CSV: tételes, könyvelőbarát export magyar Excel / WPS Office-hoz.
 * Elválasztó: pontosvessző; kódolás: UTF-8 BOM.
 */

import { formatAdminOrderStatusLabel } from '@/lib/admin-order-badges'
import { orderItemSpecForAdmin } from '@/lib/production-payload'
import {
  formatInternalPointsSettlement,
  invoiceAmountsForOrder,
} from '@/lib/order-points-accounting'

export const ORDERS_CSV_SEPARATOR = ';'

export const ORDERS_CSV_HEADERS = [
  'Rendelés ID',
  'Dátum és Idő',
  'Vevő Neve',
  'Vevő Email',
  'Státusz',
  'Termék Neve',
  'SKU / Termékkód',
  'Anyag',
  'Szín',
  'Darabszám',
  'Egységár',
  'Összesen',
  'Fizetési Típus / Típus',
  'Pont kedvezmény (Ft)',
  'Felhasznált pont',
  'Ajándékpont (Ft)',
  'Aktivitási pont (Ft)',
  'Számlázandó termék (Ft)',
  'Szállítási díj (Ft)',
  'Számlázandó (Ft)',
  'Elszámolás',
] as const

export type OrdersCsvItem = {
  name?: string | null
  sku?: string | null
  qty: number
  priceHuf: number
  fulfillmentType?: string | null
  parameters?: unknown
}

export type OrdersCsvOrder = {
  id: string
  createdAt: Date
  customerName?: string | null
  customerEmail?: string | null
  status: string
  orderType?: string | null
  items?: OrdersCsvItem[] | null
  pointsUsed?: number | null
  pointsDiscountHuf?: number | null
  giftPointsUsed?: number | null
  subtotalHuf?: number | null
  discountHuf?: number | null
  totalHuf?: number | null
}

export function escapeCsvField(value: string, separator = ORDERS_CSV_SEPARATOR): string {
  if (value.includes(separator) || /["\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Könyvelői dátum: Budapest-idő, `YYYY-MM-DD HH:mm:ss`. */
export function formatOrdersCsvDateTime(date: Date): string {
  return date
    .toLocaleString('sv-SE', {
      timeZone: 'Europe/Budapest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace('T', ' ')
}

export function formatOrdersCsvPaymentType(
  orderType: string | null | undefined,
  fulfillmentType?: string | null
): string {
  const type = orderType?.trim()
  if (type) return type
  if (fulfillmentType === 'procurement') return 'sourcing'
  if (fulfillmentType === 'stock') return 'in_stock'
  return fulfillmentType?.trim() || ''
}

function csvCell(value: string | number): string {
  return escapeCsvField(String(value))
}

function buildItemRow(order: OrdersCsvOrder, item: OrdersCsvItem | null): string {
  const spec = item
    ? orderItemSpecForAdmin(item)
    : { nev: '', sku: '', anyag: '', szin: '', darabszam: 0 }
  const qty = item ? Math.max(0, Math.floor(item.qty) || 0) : 0
  const unitHuf = item ? item.priceHuf : 0
  const lineHuf = unitHuf * qty
  const pointsDiscountHuf = Math.max(0, Math.floor(order.pointsDiscountHuf ?? 0))
  const pointsUsed = Math.max(0, Math.floor(order.pointsUsed ?? 0))
  const invoice = invoiceAmountsForOrder({
    subtotalHuf: Math.max(0, Math.floor(order.subtotalHuf ?? 0)),
    discountHuf: order.discountHuf ?? 0,
    pointsDiscountHuf,
    totalHuf: Math.max(0, Math.floor(order.totalHuf ?? 0)),
    pointsUsed,
    giftPointsUsed: order.giftPointsUsed ?? 0,
  })
  return [
    csvCell(order.id),
    csvCell(formatOrdersCsvDateTime(order.createdAt)),
    csvCell(order.customerName?.trim() || ''),
    csvCell(order.customerEmail?.trim() || ''),
    csvCell(formatAdminOrderStatusLabel(order.status)),
    csvCell(item ? spec.nev : ''),
    csvCell(item ? spec.sku : ''),
    csvCell(item ? spec.anyag : ''),
    csvCell(item ? spec.szin : ''),
    csvCell(qty),
    csvCell(unitHuf),
    csvCell(lineHuf),
    csvCell(formatOrdersCsvPaymentType(order.orderType, item?.fulfillmentType)),
    csvCell(pointsDiscountHuf),
    csvCell(pointsUsed),
    csvCell(invoice.internalGiftHuf),
    csvCell(invoice.internalActivityHuf),
    csvCell(invoice.invoiceMerchandiseHuf),
    csvCell(invoice.invoiceShippingHuf),
    csvCell(invoice.invoiceTotalHuf),
    csvCell(formatInternalPointsSettlement(order)),
  ].join(ORDERS_CSV_SEPARATOR)
}

/** UTF-8 BOM + tételes sorok (egy rendelés több tétel = több CSV-sor). */
export function buildOrdersCsv(orders: OrdersCsvOrder[]): string {
  const lines = [ORDERS_CSV_HEADERS.join(ORDERS_CSV_SEPARATOR)]
  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : []
    if (items.length === 0) {
      lines.push(buildItemRow(order, null))
      continue
    }
    for (const item of items) {
      lines.push(buildItemRow(order, item))
    }
  }
  return `\uFEFF${lines.join('\r\n')}`
}

/** Excel / WPS: UTF-8 BOM bájtok (EF BB BF), ne csak JS string `\uFEFF`. */
export function encodeCsvUtf8Bom(csv: string): Uint8Array {
  const withoutBom = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv
  const payload = new TextEncoder().encode(withoutBom)
  const out = new Uint8Array(3 + payload.length)
  out[0] = 0xef
  out[1] = 0xbb
  out[2] = 0xbf
  out.set(payload, 3)
  return out
}
