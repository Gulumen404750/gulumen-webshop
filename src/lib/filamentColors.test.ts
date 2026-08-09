import { describe, expect, it } from 'vitest'
import {
  getAvailableColorVariants,
  getGalleryImagesForColor,
  shouldShowStorefrontColorPicker,
  type ColorVariant,
} from '@/lib/filamentColors'

describe('shouldShowStorefrontColorPicker', () => {
  it('hides picker for products without color variants', () => {
    expect(shouldShowStorefrontColorPicker(null, false)).toBe(false)
    expect(shouldShowStorefrontColorPicker([], false)).toBe(false)
  })

  it('hides picker when only one imaged color exists (egyszínű)', () => {
    const variants: ColorVariant[] = [
      { id: 'white', name: 'Fehér', hex: '#ffffff', images: ['/a.jpg'], isBase: true },
    ]
    expect(shouldShowStorefrontColorPicker(variants, false)).toBe(false)
  })

  it('shows picker when at least two imaged colors exist', () => {
    const variants: ColorVariant[] = [
      { id: 'white', name: 'Fehér', hex: '#ffffff', images: ['/a.jpg'], isBase: true },
      { id: 'black', name: 'Fekete', hex: '#111111', images: ['/b.jpg'] },
    ]
    expect(shouldShowStorefrontColorPicker(variants, false)).toBe(true)
    expect(getAvailableColorVariants(variants, false)).toHaveLength(2)
  })
})

describe('getGalleryImagesForColor', () => {
  it('falls back to base variant images when product.images is empty', () => {
    const gallery = getGalleryImagesForColor(
      {
        image: '',
        images: [],
        colorImages: [
          { id: 'white', name: 'Fehér', hex: '#ffffff', images: ['/base.jpg'], isBase: true },
        ],
      },
      null
    )
    expect(gallery).toEqual(['/base.jpg'])
  })
})
