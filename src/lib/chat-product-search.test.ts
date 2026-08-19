import { describe, expect, it } from 'vitest'
import {
  buildRecommendedProductsChatBlock,
  extractSearchKeywords,
  isProductSearchQuery,
  resolveChatProductSearchIntent,
  scoreProductAgainstKeywords,
  type ChatRecommendedProduct,
} from './chat-product-search'

describe('isProductSearchQuery', () => {
  it('detects product intent keywords', () => {
    expect(isProductSearchQuery('Lámpát keresek a nappaliba')).toBe(true)
    expect(isProductSearchQuery('Recommend a bag')).toBe(true)
    expect(isProductSearchQuery('Mit vegyek ajándékba?')).toBe(true)
    expect(isProductSearchQuery('Ajánlj valamit')).toBe(true)
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

describe('resolveChatProductSearchIntent', () => {
  it('keeps a specific product noun even in a gift sentence', () => {
    const intent = resolveChatProductSearchIntent('Lámpát keresek ajándékba')
    expect(intent.isProductSearch).toBe(true)
    expect(intent.recommendOnly).toBe(false)
    expect(intent.specificKeywords.some((k) => k.includes('lámp') || k.includes('lamp'))).toBe(
      true
    )
  })

  it('treats vague recommend / gift phrases as catalog browse, not a missing SKU', () => {
    expect(resolveChatProductSearchIntent('Ajánlj valamit').recommendOnly).toBe(true)
    expect(resolveChatProductSearchIntent('Recommend something please').recommendOnly).toBe(true)
    expect(resolveChatProductSearchIntent('Ajándékot keresek').recommendOnly).toBe(true)
    expect(resolveChatProductSearchIntent('Mit vegyek ajándékba?').recommendOnly).toBe(true)
  })
})

describe('scoreProductAgainstKeywords', () => {
  it('does not treat a laptop bag as a lamp', () => {
    const bag = { name: 'Laptop táska', slug: 'laptop-taska', category: 'Táskák' }
    expect(scoreProductAgainstKeywords(bag, ['lámpa', 'lampa', 'lamp'])).toBe(0)
  })

  it('matches stemmed Hungarian lamp names', () => {
    const lamp = { name: 'Asztali lámpa', slug: 'asztali-lampa', category: 'Otthon' }
    expect(scoreProductAgainstKeywords(lamp, extractSearchKeywords('Mutass lámpákat'))).toBeGreaterThan(
      0
    )
  })
})

describe('extractSearchKeywords', () => {
  it('keeps product nouns and drops stop words', () => {
    const kws = extractSearchKeywords('Szeretnék egy asztali lámpát')
    expect(kws.some((k) => k.includes('lámp') || k.includes('lamp'))).toBe(true)
    expect(kws).not.toContain('szeretnék')
    expect(kws).not.toContain('egy')
  })

  it('stems Hungarian plural/accusative so lámpákat matches lámpa', () => {
    const kws = extractSearchKeywords('Mutass lámpákat')
    expect(kws.some((k) => stripMatch(k))).toBe(true)
    expect(kws).not.toContain('mutass')
  })

  it('treats recommend-only phrases as having no product noun keywords', () => {
    expect(extractSearchKeywords('Ajánlj valamit')).toEqual([])
    expect(extractSearchKeywords('Recommend something please')).toEqual([])
  })
})

function stripMatch(k: string): boolean {
  const ascii = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return ascii.includes('lamp') || k.includes('lámp')
}

describe('stemSearchToken', () => {
  it('reduces lámpákat to lampa stem', async () => {
    const { stemSearchToken } = await import('./chat-product-search')
    const stems = stemSearchToken('lámpákat')
    expect(stems.some((s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'lampa')).toBe(
      true
    )
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
    expect(block).toMatch(/SOHA ne mondd/i)
    expect(block).toMatch(/termékkárty/i)
    expect(block).toMatch(/ÚJ SORON/)
    expect(block).toMatch(/emoji/i)
  })

  it('requires alternatives to be labeled when there is no exact match', () => {
    const products: ChatRecommendedProduct[] = [
      {
        id: 'p1',
        slug: 'taska',
        name: 'Vászon táska',
        priceHuf: 4990,
        discountPriceHuf: null,
        onSale: false,
        saleStartAt: null,
        saleEndAt: null,
        image: '/img/taska.jpg',
        category: 'Táskák',
      },
    ]
    const block = buildRecommendedProductsChatBlock(products, {
      matchKind: 'alternatives',
      missingExactMatch: true,
    })
    expect(block).toContain('[NINCS PONTOS TERMÉKTALÁLAT')
    expect(block).toMatch(/ALTERNATÍV/i)
    expect(block).toContain('Vászon táska')
    expect(block).toMatch(/nem a kért termék/i)
    expect(block).not.toMatch(/SOHA ne mondd/i)
  })

  it('states clearly when nothing in the catalog matches', () => {
    const block = buildRecommendedProductsChatBlock([], {
      matchKind: 'none',
      missingExactMatch: true,
    })
    expect(block).toContain('[NINCS PONTOS TERMÉKTALÁLAT]')
    expect(block).toMatch(/nincs a kínálatunkban/i)
    expect(block).toMatch(/TILOS kitalált/i)
  })

  it('requires the model to list every recommended product by exact name', () => {
    const products: ChatRecommendedProduct[] = [
      {
        id: 'p1',
        slug: 'a',
        name: 'Alpha',
        priceHuf: 1000,
        discountPriceHuf: null,
        onSale: false,
        saleStartAt: null,
        saleEndAt: null,
        image: '/a.jpg',
        category: 'Otthon',
      },
      {
        id: 'p2',
        slug: 'b',
        name: 'Beta',
        priceHuf: 2000,
        discountPriceHuf: null,
        onSale: false,
        saleStartAt: null,
        saleEndAt: null,
        image: '/b.jpg',
        category: 'Otthon',
      },
      {
        id: 'p3',
        slug: 'c',
        name: 'Gamma',
        priceHuf: 3000,
        discountPriceHuf: null,
        onSale: false,
        saleStartAt: null,
        saleEndAt: null,
        image: '/c.jpg',
        category: 'Otthon',
      },
    ]
    const block = buildRecommendedProductsChatBlock(products)
    expect(block).toContain('3 db')
    expect(block).toContain('listád hossza = 3')
    expect(block).toContain('Alpha')
    expect(block).toContain('Beta')
    expect(block).toContain('Gamma')
    expect(block).toMatch(/kényelmes párna/)
  })
})

describe('dismissed products stay out of chat recommendations', () => {
  it('filters excluded ids when merging recommend results', async () => {
    const { excludeDismissedItems } = await import('./wishlist-sync')
    const products = [
      { id: 'keep', name: 'Keep' },
      { id: 'gone', name: 'Gone' },
    ]
    expect(excludeDismissedItems(products, ['gone'])).toEqual([{ id: 'keep', name: 'Keep' }])
  })
})
