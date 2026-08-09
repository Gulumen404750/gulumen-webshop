import { describe, expect, it } from 'vitest'
import {
  buildRecommendedProductsChatBlock,
  extractSearchKeywords,
  isProductSearchQuery,
  type ChatRecommendedProduct,
} from './chat-product-search'

describe('isProductSearchQuery', () => {
  it('detects product intent keywords', () => {
    expect(isProductSearchQuery('Lámpát keresek a nappaliba')).toBe(true)
    expect(isProductSearchQuery('Recommend a bag')).toBe(true)
    expect(isProductSearchQuery('Mit vegyek ajándékba?')).toBe(true)
  })

  it('ignores pure shipping / payment questions', () => {
    expect(isProductSearchQuery('Mikor érkezik a csomagom?')).toBe(false)
    expect(isProductSearchQuery('Hogyan tudok fizetni?')).toBe(false)
  })

  it('ignores greetings and thanks', () => {
    expect(isProductSearchQuery('Szia')).toBe(false)
    expect(isProductSearchQuery('Köszönöm')).toBe(false)
  })
})

describe('extractSearchKeywords', () => {
  it('keeps product nouns and drops stop words', () => {
    const kws = extractSearchKeywords('Szeretnék egy asztali lámpát')
    expect(kws.some((k) => k.includes('lámp') || k.includes('lamp'))).toBe(true)
    expect(kws).not.toContain('szeretnék')
    expect(kws).not.toContain('egy')
  })
})

describe('buildRecommendedProductsChatBlock', () => {
  it('lists products with live prices for the model', () => {
    const products: ChatRecommendedProduct[] = [
      {
        id: 'p1',
        slug: 'asztali-lampa',
        name: 'Asztali lámpa',
        priceHuf: 8990,
        discountPriceHuf: null,
        onSale: false,
        saleStartAt: null,
        saleEndAt: null,
        image: '/img/lampa.jpg',
        category: 'Otthon',
      },
    ]
    const block = buildRecommendedProductsChatBlock(products)
    expect(block).toContain('[AJÁNLOTT TERMÉKEK')
    expect(block).toContain('Asztali lámpa')
    expect(block).toContain('/termek/asztali-lampa')
    expect(block).toMatch(/8[\u00a0 ]?990 Ft/)
  })
})
