import { describe, expect, it } from 'vitest'
import {
  CASH_SETTLEMENT_LABEL,
  INTERNAL_POINTS_ACCOUNTING_NOTE,
  INTERNAL_POINTS_PAYMENT_LABEL,
  formatInternalPointsSettlement,
  internalPointsLedgerMetadata,
  orderUsedInternalPoints,
} from './order-points-accounting'

describe('internal points accounting', () => {
  it('detects wallet or gift-point payments', () => {
    expect(orderUsedInternalPoints({ pointsUsed: 0, pointsDiscountHuf: 0 })).toBe(false)
    expect(orderUsedInternalPoints({ pointsUsed: 500, pointsDiscountHuf: 500 })).toBe(true)
    expect(orderUsedInternalPoints({ pointsUsed: 0, pointsDiscountHuf: 1 })).toBe(true)
  })

  it('labels internal settlement for the accountant', () => {
    expect(formatInternalPointsSettlement({ pointsUsed: 1200 })).toBe(INTERNAL_POINTS_ACCOUNTING_NOTE)
    expect(formatInternalPointsSettlement({ pointsUsed: 0 })).toBe(CASH_SETTLEMENT_LABEL)
    expect(INTERNAL_POINTS_PAYMENT_LABEL).toContain('Ajándékpont')
    expect(INTERNAL_POINTS_ACCOUNTING_NOTE).toContain('nem pénzbeni profit')
  })

  it('tags ledger metadata as non-cash internal points', () => {
    const meta = internalPointsLedgerMetadata({ orderId: 'ord_1' })
    expect(meta.accountingKind).toBe('internal_points')
    expect(meta.nonCashProfit).toBe(true)
    expect(meta.note).toBe(INTERNAL_POINTS_ACCOUNTING_NOTE)
    expect(meta.orderId).toBe('ord_1')
  })
})
