import { describe, expect, it } from 'vitest'
import { getAdminOrderVisualKind, adminOrderKindClasses } from './admin-order-badges'

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
    expect(adminOrderKindClasses('new_unprinted').row).toMatch(/violet/)
    expect(adminOrderKindClasses('printed_processing').row).toMatch(/emerald/)
  })
})
