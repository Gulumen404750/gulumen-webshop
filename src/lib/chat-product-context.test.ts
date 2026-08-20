import { describe, expect, it } from 'vitest'
import {
  buildProductChatContextBlock,
  extractProductSlugFromPathname,
  resolveChatProductPricing,
  resolveChatProductPriceHuf,
} from './chat-product-context'

const base = {
  id: 'p1',
  slug: 'proba-taska',
  name: 'Próba táska',
  description_hu: 'Rövid leírás',
  aiKnowledgeBase: 'Anyag: bőr. Tisztítás: szárazon.',
  stock: 3,
  active: true,
  archived: false,
}

describe('extractProductSlugFromPathname', () => {
  it('reads slug from product page path', () => {
    expect(extractProductSlugFromPathname('/termek/proba-taska')).toBe('proba-taska')
  })

  it('reads slug from /products alias path', () => {
    expect(extractProductSlugFromPathname('/products/proba-taska')).toBe('proba-taska')
  })

  it('returns null on non-product paths', () => {
    expect(extractProductSlugFromPathname('/kosar')).toBeNull()
  })
})

describe('resolveChatProductPricing', () => {
  it('uses sale price when sale window is active', () => {
    const now = new Date('2026-08-09T12:00:00.000Z')
    const pricing = resolveChatProductPricing(
      {
        priceHuf: 10000,
        discountPriceHuf: 8000,
        onSale: true,
        saleStartAt: '2026-08-01T00:00:00.000Z',
        saleEndAt: '2026-08-31T23:59:59.000Z',
      },
      now
    )
    expect(pricing.isSale).toBe(true)
    expect(pricing.effectivePriceHuf).toBe(8000)
    expect(pricing.normalPriceHuf).toBe(10000)
  })

  it('uses normal price when sale window is outside', () => {
    const now = new Date('2026-09-10T12:00:00.000Z')
    const pricing = resolveChatProductPricing(
      {
        priceHuf: 10000,
        discountPriceHuf: 8000,
        onSale: true,
        saleStartAt: '2026-08-01T00:00:00.000Z',
        saleEndAt: '2026-08-31T23:59:59.000Z',
      },
      now
    )
    expect(pricing.isSale).toBe(false)
    expect(pricing.effectivePriceHuf).toBe(10000)
  })

  it('falls back to base price without sale flag', () => {
    expect(
      resolveChatProductPriceHuf({
        priceHuf: 10000,
        discountPriceHuf: 8000,
        onSale: false,
      })
    ).toBe(10000)
  })
})

describe('buildProductChatContextBlock', () => {
  it('includes live price block and knowledge base', () => {
    const block = buildProductChatContextBlock({
      ...base,
      priceHuf: 12000,
      discountPriceHuf: null,
      onSale: false,
      saleStartAt: null,
      saleEndAt: null,
    })
    expect(block).toContain('[AKTUÁLIS TERMÉK ÉLES ADATAI]')
    expect(block).toContain('Termék neve: Próba táska')
    expect(block).toMatch(/Jelenlegi ár:\s*12[\u00a0 ]?000 Ft/)
    expect(block).not.toMatch(/Akciós ár/)
    expect(block).toContain('Anyag: bőr')
    expect(block).toMatch(/Árról \/ akcióról CSAK/i)
  })

  it('quotes live EUR for English shoppers without HUF', () => {
    const block = buildProductChatContextBlock(
      {
        ...base,
        priceHuf: 12000,
        discountPriceHuf: null,
        onSale: false,
        saleStartAt: null,
        saleEndAt: null,
      },
      new Date(),
      { locale: 'en', rate: 395 }
    )
    expect(block).toMatch(/Jelenlegi ár:\s*€/)
    expect(block).not.toMatch(/Jelenlegi ár:[^\n]*(HUF|Ft)/)
    expect(block).toMatch(/NE írj HUF-ot/)
  })

  it('marks active sale with original price', () => {
    const now = new Date('2026-08-09T12:00:00.000Z')
    const block = buildProductChatContextBlock(
      {
        ...base,
        priceHuf: 12000,
        discountPriceHuf: 9000,
        onSale: true,
        saleStartAt: '2026-08-01T00:00:00.000Z',
        saleEndAt: '2026-08-31T23:59:59.000Z',
      },
      now
    )
    expect(block).toMatch(/Jelenlegi ár:\s*9[\u00a0 ]?000 Ft \(Akciós ár!/)
    expect(block).toMatch(/Eredeti ár:\s*12[\u00a0 ]?000 Ft/)
  })

  it('falls back to description when knowledge base empty', () => {
    const block = buildProductChatContextBlock({
      ...base,
      priceHuf: 1000,
      discountPriceHuf: null,
      onSale: false,
      saleStartAt: null,
      saleEndAt: null,
      aiKnowledgeBase: null,
      description_hu: 'Csak leírás',
      stock: -1,
    })
    expect(block).toContain('Csak leírás')
    expect(block).toContain('Készletállapot: Raktáron')
  })
})
