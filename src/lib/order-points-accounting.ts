/**
 * Pontalapú / NFC ajándékpontos rendelések könyvelési megkülönböztetése.
 * 1 pont = 1 Ft; ez belső elszámolás, nem pénzbeni profit.
 * A ponttal nem fedezett termékár + szállítás a számlázandó (kártyás) összeg.
 */

export const INTERNAL_POINTS_PAYMENT_LABEL = 'Belső pontrendszer / Ajándékpont'

export const INTERNAL_POINTS_ACCOUNTING_NOTE =
  'Belső pontrendszer / Ajándékpont – belső elszámolás (nem pénzbeni profit)'

export const ACTIVITY_POINTS_ACCOUNTING_NOTE =
  'Aktivitási pont – belső elszámolás (nem pénzbeni profit), 1:1 a termékár 100%-áig'

export const GIFT_POINTS_ACCOUNTING_NOTE =
  'Ajándékpont (NFC / kampány) – belső elszámolás (nem pénzbeni profit), 100%-ban levásárolható'

export const CASH_SETTLEMENT_LABEL = 'Pénzbeni fizetés'

export const INVOICE_DUE_LABEL = 'Számlázandó (kártya / számla)'

export function orderUsedInternalPoints(order: {
  /** Kosár / checkout alias a felhasznált pontokra. */
  usedPoints?: number | null
  pointsUsed?: number | null
  pointsDiscountHuf?: number | null
  giftPointsUsed?: number | null
}): boolean {
  return (
    toNonNegInt(order.usedPoints) > 0 ||
    toNonNegInt(order.pointsUsed) > 0 ||
    toNonNegInt(order.pointsDiscountHuf) > 0 ||
    toNonNegInt(order.giftPointsUsed) > 0
  )
}

/** Rendeléscsoport: ha bármelyik tétel ponttal volt fizetve, a tranzakció nem tiszta kártyás. */
export function anyOrderUsedInternalPoints(
  orders: Array<{
    usedPoints?: number | null
    pointsUsed?: number | null
    pointsDiscountHuf?: number | null
    giftPointsUsed?: number | null
  }>
): boolean {
  return orders.some(orderUsedInternalPoints)
}

function toNonNegInt(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function splitOrderPointUsage(order: {
  pointsUsed?: number | null
  giftPointsUsed?: number | null
}): { giftPointsUsed: number; activityPointsUsed: number; pointsUsed: number } {
  const pointsUsed = Math.max(0, Math.floor(order.pointsUsed ?? 0))
  const giftPointsUsed = Math.min(pointsUsed, Math.max(0, Math.floor(order.giftPointsUsed ?? 0)))
  return {
    giftPointsUsed,
    activityPointsUsed: Math.max(0, pointsUsed - giftPointsUsed),
    pointsUsed,
  }
}

export function formatInternalPointsSettlement(order: {
  pointsUsed?: number | null
  pointsDiscountHuf?: number | null
  giftPointsUsed?: number | null
}): string {
  return orderUsedInternalPoints(order) ? INTERNAL_POINTS_ACCOUNTING_NOTE : CASH_SETTLEMENT_LABEL
}

export type OrderInvoiceSplit = {
  invoiceMerchandiseHuf: number
  invoiceShippingHuf: number
  invoiceTotalHuf: number
  internalGiftHuf: number
  internalActivityHuf: number
  internalPointsHuf: number
}

/** Ponttal nem fedezett rész: termék maradék + szállítás = számlázandó. */
export function invoiceAmountsForOrder(order: {
  subtotalHuf: number
  discountHuf?: number | null
  pointsDiscountHuf?: number | null
  totalHuf: number
  pointsUsed?: number | null
  giftPointsUsed?: number | null
}): OrderInvoiceSplit {
  const pointsDiscountHuf = Math.max(0, Math.floor(order.pointsDiscountHuf ?? 0))
  const invoiceMerchandiseHuf = Math.max(
    0,
    Math.floor(order.subtotalHuf) - Math.max(0, Math.floor(order.discountHuf ?? 0)) - pointsDiscountHuf
  )
  const invoiceTotalHuf = Math.max(0, Math.floor(order.totalHuf))
  const invoiceShippingHuf = Math.max(0, invoiceTotalHuf - invoiceMerchandiseHuf)
  const split = splitOrderPointUsage(order)
  return {
    invoiceMerchandiseHuf,
    invoiceShippingHuf,
    invoiceTotalHuf,
    internalGiftHuf: split.giftPointsUsed,
    internalActivityHuf: split.activityPointsUsed,
    internalPointsHuf: pointsDiscountHuf,
  }
}

/** Ledger / grant metadata – a könyvelés ezeket a tételeket nem pénzbeni profitként kezeli. */
export function internalPointsLedgerMetadata(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    accountingKind: 'internal_points',
    nonCashProfit: true,
    rate: '1 pont = 1 Ft',
    note: INTERNAL_POINTS_ACCOUNTING_NOTE,
    ...extra,
  }
}
