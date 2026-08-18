/**
 * Pontalapú / NFC ajándékpontos rendelések könyvelési megkülönböztetése.
 * 1 pont = 1 Ft; ez belső elszámolás, nem pénzbeni profit.
 */

export const INTERNAL_POINTS_PAYMENT_LABEL = 'Belső pontrendszer / Ajándékpont'

export const INTERNAL_POINTS_ACCOUNTING_NOTE =
  'Belső pontrendszer / Ajándékpont – belső elszámolás (nem pénzbeni profit)'

export const CASH_SETTLEMENT_LABEL = 'Pénzbeni fizetés'

export function orderUsedInternalPoints(order: {
  pointsUsed?: number | null
  pointsDiscountHuf?: number | null
}): boolean {
  return (order.pointsUsed ?? 0) > 0 || (order.pointsDiscountHuf ?? 0) > 0
}

export function formatInternalPointsSettlement(order: {
  pointsUsed?: number | null
  pointsDiscountHuf?: number | null
}): string {
  return orderUsedInternalPoints(order) ? INTERNAL_POINTS_ACCOUNTING_NOTE : CASH_SETTLEMENT_LABEL
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
