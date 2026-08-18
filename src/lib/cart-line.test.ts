import { describe, expect, it } from 'vitest'
import {
  buildCartItemSnapshot,
  resolveCartLine,
  resolveCartLinePriceHuf,
} from '@/lib/cart-line'
import type { Product } from '@/lib/data'
import type { CartItem } from '@/lib/cart-storage'
import { PLACEHOLDER_IMAGE } from '@/lib/cdn'

const baseProduct = {
  id: 'cmskymdcz0000ph3itkhmb5tg',
  name: 'Kuka konyhába',
  nameEn: 'Kitchen bin',
  slug: 'kuka-konyhaba',
  description: 'Teszt',
  priceHuf: 4500,
  priceEur: 12,
  condition: 'Új' as const,
  category: '3d-konyha',
  image: 'https://gulumen.b-cdn.net/kuka/main.jpg',
  images: ['https://gulumen.b-cdn.net/kuka/main.jpg'],
  stock: 10,
  isNew: false,
  onSale: false,
  type: 'stock' as const,
  colorImages: [
    {
      id: 'black',
      name: 'Fekete',
      hex: '#1a1a1a',
      images: ['https://gulumen.b-cdn.net/kuka/black.jpg'],
      isBase: true,
    },
    {
      id: 'red',
      name: 'Piros',
      hex: '#c41e3a',
      images: ['https://gulumen.b-cdn.net/kuka/red.jpg'],
    },
  ],
} as Product

describe('cart-line snapshot', () => {
  it('stores name, price and base image on add', () => {
    const snap = buildCartItemSnapshot(baseProduct)
    expect(snap.name).toBe('Kuka konyhába')
    expect(snap.priceHuf).toBe(4500)
    expect(snap.image).toContain('black.jpg')
  })

  it('uses selected color image when options set', () => {
    const snap = buildCartItemSnapshot(baseProduct, {
      colorName: 'Piros',
      colorHex: '#c41e3a',
    })
    expect(snap.image).toContain('red.jpg')
  })

  it('falls back to snapshot when product missing (no raw id / 0 Ft)', () => {
    const item: CartItem = {
      productId: baseProduct.id,
      qty: 2,
      name: 'Kuka konyhába',
      priceHuf: 4500,
      image: 'https://gulumen.b-cdn.net/kuka/main.jpg',
    }
    const line = resolveCartLine(item, undefined, 'hu')
    expect(line.name).toBe('Kuka konyhába')
    expect(line.name).not.toBe(baseProduct.id)
    expect(line.priceHuf).toBe(4500)
    expect(line.image).toContain('main.jpg')
    expect(resolveCartLinePriceHuf(item, undefined)).toBe(4500)
  })

  it('uses placeholder when image missing', () => {
    const item: CartItem = {
      productId: 'x',
      qty: 1,
      name: 'Teszt',
      priceHuf: 1000,
    }
    const line = resolveCartLine(item, undefined, 'hu')
    expect(line.image).toBe(PLACEHOLDER_IMAGE)
  })

  it('uses a localized product label when the name is missing', () => {
    const item: CartItem = { productId: 'cmskymdcz0000ph3itkhmb5tg', qty: 1 }
    expect(resolveCartLine(item, undefined, 'en').name).toBe('Product')
    expect(resolveCartLine(item, undefined, 'hu').name).toBe('Termék')
    expect(resolveCartLine(item, undefined, 'de').name).toBe('Produkt')
  })
})
