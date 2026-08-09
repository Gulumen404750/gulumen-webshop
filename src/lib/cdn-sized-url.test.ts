import { describe, expect, it } from 'vitest'
import { cdnGalleryMainUrl, cdnSizedUrl, cdnThumbnailUrl } from './cdn'

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

  it('builds thumbnail and main presets', () => {
    const thumb = cdnThumbnailUrl('https://gulumen.b-cdn.net/x.jpg')
    const main = cdnGalleryMainUrl('https://gulumen.b-cdn.net/x.jpg')
    expect(thumb).toContain('width=160')
    expect(main).toContain('width=1200')
  })
})
