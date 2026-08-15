import { describe, expect, it } from 'vitest'
import {
  getAdminOrderVisualKind,
  adminOrderKindClasses,
  getOrderPrintRowStyles,
  getOrderPrintBadgeStyles,
  isOrderPrinted,
} from './admin-order-badges'

describe('isOrderPrinted', () => {
  it('treats null/empty as not printed', () => {
    expect(isOrderPrinted(null)).toBe(false)
    expect(isOrderPrinted('')).toBe(false)
  })

  it('treats printedAt as printed', () => {
    expect(isOrderPrinted('2026-08-09T12:00:00.000Z')).toBe(true)
  })
})

describe('hasShippingAddressChanged', () => {
  it('is false when unset', async () => {
    const { hasShippingAddressChanged } = await import('./admin-order-badges')
    expect(hasShippingAddressChanged(null)).toBe(false)
    expect(hasShippingAddressChanged(undefined)).toBe(false)
  })

  it('is true when timestamp set', async () => {
    const { hasShippingAddressChanged } = await import('./admin-order-badges')
    expect(hasShippingAddressChanged('2026-08-15T12:00:00.000Z')).toBe(true)
  })
})

describe('getOrderPrintRowStyles / badge', () => {
  it('uses purple full-row for unprinted', () => {
    expect(getOrderPrintRowStyles(false)).toMatch(/purple/)
    expect(getOrderPrintBadgeStyles(false).label).toBe('Új – címke vár')
    expect(getOrderPrintBadgeStyles(false).className).toMatch(/purple/)
  })

  it('uses emerald full-row for printed', () => {
    expect(getOrderPrintRowStyles(true)).toMatch(/emerald/)
    expect(getOrderPrintBadgeStyles(true).label).toBe('Címke kinyomtatva')
    expect(getOrderPrintBadgeStyles(true).className).toMatch(/emerald/)
  })
})

describe('getAdminOrderVisualKind', () => {
  it('marks paid without print as new_unprinted', () => {
    expect(getAdminOrderVisualKind('paid', null)).toBe('new_unprinted')
  })

  it('marks printed paid as printed_processing', () => {
    expect(getAdminOrderVisualKind('paid', '2026-08-09T12:00:00.000Z')).toBe('printed_processing')
  })

  it('marks fulfilled as fulfilled even if printed', () => {
    expect(getAdminOrderVisualKind('fulfilled', '2026-08-09T12:00:00.000Z')).toBe('fulfilled')
  })

  it('marks cancelled separately', () => {
    expect(getAdminOrderVisualKind('cancelled', null)).toBe('cancelled')
  })
})

describe('adminOrderKindClasses', () => {
  it('returns distinct badge labels', () => {
    expect(adminOrderKindClasses('new_unprinted').label).toMatch(/címke/i)
    expect(adminOrderKindClasses('printed_processing').label).toMatch(/kinyomtatva/i)
    expect(adminOrderKindClasses('fulfilled').label).toMatch(/Teljesítve/)
  })

  it('uses purple row for unprinted and green for printed', () => {
    expect(adminOrderKindClasses('new_unprinted').row).toMatch(/purple/)
    expect(adminOrderKindClasses('printed_processing').row).toMatch(/emerald/)
  })
})
