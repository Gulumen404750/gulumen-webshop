import { describe, expect, it } from 'vitest'
import {
  CASH_SETTLEMENT_LABEL,
  INTERNAL_POINTS_ACCOUNTING_NOTE,
  INTERNAL_POINTS_PAYMENT_LABEL,
  formatInternalPointsSettlement,
  invoiceAmountsForOrder,
  internalPointsLedgerMetadata,
  orderUsedInternalPoints,
  splitOrderPointUsage,
} from './order-points-accounting'

describe('internal points accounting', () => {
  it('detects wallet or gift-point payments', () => {
    expect(orderUsedInternalPoints({ pointsUsed: 0, pointsDiscountHuf: 0 })).toBe(false)
    expect(orderUsedInternalPoints({ pointsUsed: 500, pointsDiscountHuf: 500 })).toBe(true)
    expect(orderUsedInternalPoints({ pointsUsed: 0, pointsDiscountHuf: 1 })).toBe(true)
    expect(orderUsedInternalPoints({ giftPointsUsed: 200 })).toBe(true)
  })

  it('labels internal settlement for the accountant', () => {
    expect(formatInternalPointsSettlement({ pointsUsed: 1200 })).toBe(INTERNAL_POINTS_ACCOUNTING_NOTE)
    expect(formatInternalPointsSettlement({ pointsUsed: 0 })).toBe(CASH_SETTLEMENT_LABEL)
    expect(INTERNAL_POINTS_PAYMENT_LABEL).toContain('Ajándékpont')
    expect(INTERNAL_POINTS_ACCOUNTING_NOTE).toContain('nem pénzbeni profit')
  })

  it('splits gift vs activity usage for the ledger', () => {
    expect(splitOrderPointUsage({ pointsUsed: 5800, giftPointsUsed: 4000 })).toEqual({
      giftPointsUsed: 4000,
      activityPointsUsed: 1800,
      pointsUsed: 5800,
    })
  })

  it('separates non-cash points from the invoice remainder', () => {
    const split = invoiceAmountsForOrder({
      subtotalHuf: 10_000,
      discountHuf: 0,
      pointsDiscountHuf: 5_800,
      totalHuf: 4_200 + 1_990,
      pointsUsed: 5_800,
      giftPointsUsed: 4_000,
    })
    expect(split.internalGiftHuf).toBe(4_000)
    expect(split.internalActivityHuf).toBe(1_800)
    expect(split.invoiceMerchandiseHuf).toBe(4_200)
    expect(split.invoiceShippingHuf).toBe(1_990)
    expect(split.invoiceTotalHuf).toBe(6_190)
  })

  it('tags ledger metadata as non-cash internal points', () => {
    const meta = internalPointsLedgerMetadata({ orderId: 'ord_1' })
    expect(meta.accountingKind).toBe('internal_points')
    expect(meta.nonCashProfit).toBe(true)
    expect(meta.note).toBe(INTERNAL_POINTS_ACCOUNTING_NOTE)
    expect(meta.orderId).toBe('ord_1')
  })
})
