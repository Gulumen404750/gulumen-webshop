import { describe, expect, it } from 'vitest'
import { cdnCardUrl, cdnGalleryMainUrl, cdnSizedUrl, cdnThumbnailUrl } from './cdn'

describe('cdnSizedUrl', () => {
  it('appends Bunny Optimizer params for pull-zone URLs', () => {
    const out = cdnSizedUrl('https://gulumen.b-cdn.net/kuka/foto.jpg', {
      width: 160,
      height: 160,
      quality: 70,
    })
    expect(out).toContain('width=160')
    expect(out).toContain('height=160')
    expect(out).toContain('quality=70')
    expect(out.startsWith('https://gulumen.b-cdn.net/kuka/foto.jpg')).toBe(true)
  })

  it('leaves local paths unchanged', () => {
    expect(cdnSizedUrl('/uploads/a.jpg', { width: 160 })).toBe('/uploads/a.jpg')
    expect(cdnThumbnailUrl('/img/placeholder-product.svg')).toContain('placeholder')
  })

  it('builds thumbnail, card and main presets', () => {
    const thumb = cdnThumbnailUrl('https://gulumen.b-cdn.net/x.jpg')
    const card = cdnCardUrl('https://gulumen.b-cdn.net/x.jpg')
    const main = cdnGalleryMainUrl('https://gulumen.b-cdn.net/x.jpg')
    expect(thumb).toContain('width=160')
    expect(card).toContain('width=800')
    expect(card).toContain('quality=75')
    expect(main).toContain('width=1200')
  })

  it('cdnCardUrl falls back to placeholder when empty', () => {
    expect(cdnCardUrl('')).toBe('/img/placeholder-product.svg')
    expect(cdnCardUrl(null)).toBe('/img/placeholder-product.svg')
  })
})
