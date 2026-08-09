import { describe, expect, it } from 'vitest'
import {
  buildProductChatContextBlock,
  extractProductSlugFromPathname,
  resolveChatProductPriceHuf,
} from './chat-product-context'

describe('extractProductSlugFromPathname', () => {
  it('reads slug from product page path', () => {
    expect(extractProductSlugFromPathname('/termek/proba-taska')).toBe('proba-taska')
  })

  it('returns null on non-product paths', () => {
    expect(extractProductSlugFromPathname('/kosar')).toBeNull()
  })
})

describe('resolveChatProductPriceHuf', () => {
  it('uses discount when lower than base', () => {
    expect(resolveChatProductPriceHuf({ priceHuf: 10000, discountPriceHuf: 8000 })).toBe(8000)
  })

  it('falls back to base price', () => {
    expect(resolveChatProductPriceHuf({ priceHuf: 10000, discountPriceHuf: null })).toBe(10000)
  })
})

describe('buildProductChatContextBlock', () => {
  it('includes name, price and knowledge base', () => {
    const block = buildProductChatContextBlock({
      id: 'p1',
      slug: 'proba-taska',
      name: 'Próba táska',
      priceHuf: 12000,
      discountPriceHuf: null,
      description_hu: 'Rövid leírás',
      aiKnowledgeBase: 'Anyag: bőr. Tisztítás: szárazon.',
      stock: 3,
      active: true,
      archived: false,
    })
    expect(block).toContain('[AKTUÁLIS TERMÉK INFORMÁCIÓI]')
    expect(block).toContain('Név: Próba táska')
    expect(block).toMatch(/Ár:\s*12[\u00a0 ]?000 Ft/)
    expect(block).toContain('Anyag: bőr')
    expect(block).toMatch(/ne találj ki/i)
    expect(block).toMatch(/vásárló által használt nyelven/i)
  })

  it('falls back to description when knowledge base empty', () => {
    const block = buildProductChatContextBlock({
      id: 'p2',
      slug: 'x',
      name: 'X',
      priceHuf: 1000,
      discountPriceHuf: null,
      description_hu: 'Csak leírás',
      aiKnowledgeBase: null,
      stock: -1,
      active: true,
      archived: false,
    })
    expect(block).toContain('Csak leírás')
  })
})
