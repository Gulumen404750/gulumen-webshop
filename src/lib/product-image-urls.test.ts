import { describe, expect, it } from 'vitest'
import {
  absoluteFirstPartyProductImages,
  isFirstPartyImageUrl,
  toAbsoluteFirstPartyImageUrl,
} from './product-image-urls'

describe('first-party product image URLs', () => {
  it('accepts own CDN and relative shop paths', () => {
    expect(isFirstPartyImageUrl('https://gulumen.b-cdn.net/products/a.webp')).toBe(true)
    expect(isFirstPartyImageUrl('/uploads/a.webp')).toBe(true)
    expect(isFirstPartyImageUrl('/img/rolltop.png')).toBe(true)
  })

  it('rejects hotlinks, blob and data URLs', () => {
    expect(isFirstPartyImageUrl('https://cdn.supplier.example/a.jpg')).toBe(false)
    expect(isFirstPartyImageUrl('https://i.imgur.com/a.png')).toBe(false)
    expect(isFirstPartyImageUrl('blob:https://www.gulumen.com/1')).toBe(false)
    expect(isFirstPartyImageUrl('data:image/png;base64,aaa')).toBe(false)
  })

  it('absolutizes relative paths and drops optimizer query strings', () => {
    expect(toAbsoluteFirstPartyImageUrl('/img/a.png')).toMatch(/\/img\/a\.png$/)
    expect(toAbsoluteFirstPartyImageUrl('https://gulumen.b-cdn.net/a.webp?width=800')).toBe(
      'https://gulumen.b-cdn.net/a.webp'
    )
    expect(toAbsoluteFirstPartyImageUrl('https://cdn.supplier.example/a.jpg')).toBeNull()
  })

  it('collects gallery + color images and skips 360 / hotlinks', () => {
    const urls = absoluteFirstPartyProductImages({
      image: 'https://cdn.supplier.example/hot.jpg',
      images: ['https://gulumen.b-cdn.net/main.webp', '/img/local.png'],
      colorImages: [{ id: 'red', name: 'Piros', hex: '#c41e3a', images: ['https://gulumen.b-cdn.net/red.webp'] }],
    })
    expect(urls.some((u) => u.includes('supplier'))).toBe(false)
    expect(urls.some((u) => u.includes('gulumen.b-cdn.net/main.webp'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/img/local.png'))).toBe(true)
    expect(urls.some((u) => u.includes('red.webp'))).toBe(true)
  })
})
