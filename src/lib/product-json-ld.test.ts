import { describe, expect, it } from 'vitest'
import { buildProductJsonLd } from './product-json-ld'
import type { Product } from '@/lib/data'

function product(partial: Partial<Product>): Product {
  return {
    id: 'p1',
    name: 'Rolltop',
    nameEn: 'Rolltop',
    slug: 'rolltop',
    priceHuf: 10000,
    priceEur: 25,
    condition: 'Új',
    category: 'hatizsak',
    image: '',
    images: [],
    description: 'Leírás',
    stock: -1,
    ...partial,
  }
}

describe('buildProductJsonLd', () => {
  it('includes first-party CDN images and omits hotlinks', () => {
    const schema = buildProductJsonLd(
      product({
        image: 'https://cdn.supplier.example/hot.jpg',
        images: ['https://gulumen.b-cdn.net/products/rolltop.webp', 'https://i.imgur.com/nope.png'],
      })
    )
    expect(schema.image).toBe('https://gulumen.b-cdn.net/products/rolltop.webp')
  })

  it('absolutizes local /img paths', () => {
    const schema = buildProductJsonLd(
      product({
        image: '/img/rolltop-fekete-1.png',
        images: ['/img/rolltop-fekete-1.png'],
      })
    )
    expect(typeof schema.image).toBe('string')
    expect(String(schema.image)).toMatch(/\/img\/rolltop-fekete-1\.png$/)
  })

  it('omits image when only external hotlinks exist', () => {
    const schema = buildProductJsonLd(
      product({
        image: 'https://cdn.supplier.example/hot.jpg',
        images: ['https://cdn.supplier.example/hot.jpg'],
      })
    )
    expect(schema).not.toHaveProperty('image')
  })
})
