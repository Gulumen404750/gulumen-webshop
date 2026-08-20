import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('CdnImageManager avatar thumbnail wiring', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/CdnImageManager.tsx'), 'utf-8')
  const settings = readFileSync(
    join(process.cwd(), 'src/app/admin/dashboard/settings/ProfileAvatarSettings.tsx'),
    'utf-8'
  )

  it('hides empty image cards and offers a compact thumbnail + lightbox layout', () => {
    expect(src).toMatch(/previewLayout\?\: CdnImagePreviewLayout/)
    expect(src).toMatch(/previewLayout = 'gallery'/)
    expect(src).toMatch(/function isFilledImageUrl/)
    expect(src).toMatch(/\.filter\(isFilledImageUrl\)/)
    expect(src).toMatch(/compact = previewLayout === 'thumbnails'/)
    expect(src).toMatch(/h-16 w-16/)
    expect(src).toMatch(/ImagePreviewLightbox/)
    expect(src).toMatch(/aria-label=\{`Kép megtekintése/)
    expect(src).toMatch(/aria-label="Bezárás"/)
    expect(src).not.toMatch(/item\.url \|\| PLACEHOLDER_IMAGE/)
  })

  it('uses thumbnail layout on the admin chat/profile avatar settings', () => {
    expect(settings).toContain('previewLayout="thumbnails"')
    expect(settings).toContain('CdnImageManager')
    expect(settings).toMatch(/extraUrls\.filter\(\(url\) => url\.trim\(\)\.length > 0\)/)
  })
})
