import { describe, expect, it } from 'vitest'
import hu from './hu.json'
import en from './en.json'
import de from './de.json'
import ro from './ro.json'

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
      flattenKeys(value, prefix ? `${prefix}.${key}` : key)
    )
  }
  return prefix ? [prefix] : []
}

describe('storefront translation parity', () => {
  const huKeys = flattenKeys(hu).sort()
  const enKeys = flattenKeys(en).sort()
  const deKeys = flattenKeys(de).sort()
  const roKeys = flattenKeys(ro).sort()

  it('keeps the same keys in hu/en/de/ro', () => {
    expect(enKeys).toEqual(huKeys)
    expect(deKeys).toEqual(huKeys)
    expect(roKeys).toEqual(huKeys)
  })

  it('has contact form and shipping-edit keys in every locale', () => {
    for (const keys of [huKeys, enKeys, deKeys, roKeys]) {
      expect(keys).toContain('pages.contact.formTitle')
      expect(keys).toContain('pages.contact.error.generic')
      expect(keys).toContain('common.googleRedirect')
      expect(keys).toContain('cart.productFallback')
      expect(keys).toContain('orders.editSaveFailed')
      expect(keys).toContain('seo.giftClaimTitle')
    }
  })
})
