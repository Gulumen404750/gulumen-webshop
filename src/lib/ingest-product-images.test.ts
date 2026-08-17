import { describe, expect, it, vi } from 'vitest'
import { ingestProductImages, MAX_REMOTE_IMAGES_PER_SAVE } from './ingest-product-images'
import { RemoteImageIngestError } from './ingest-remote-image'

describe('ingestProductImages', () => {
  it('replaces external URLs once and leaves first-party URLs untouched', async () => {
    const ingestUrl = vi.fn(async (url: string) => {
      return `https://gulumen.b-cdn.net/products/${encodeURIComponent(url)}.webp`
    })

    const result = await ingestProductImages(
      {
        slug: 'rolltop-fekete',
        image: 'https://cdn.supplier.example/main.jpg',
        images: [
          'https://cdn.supplier.example/main.jpg',
          'https://gulumen.b-cdn.net/products/already.webp',
          '/img/local.png',
        ],
        images360: ['https://cdn.supplier.example/360.jpg'],
        colorImages: [
          {
            id: 'black',
            name: 'Fekete',
            hex: '#111111',
            images: ['https://cdn.supplier.example/main.jpg', 'https://cdn.supplier.example/side.jpg'],
          },
        ],
      },
      ingestUrl
    )

    expect(ingestUrl).toHaveBeenCalledTimes(3)
    expect(result.ingestedCount).toBe(3)
    expect(result.image).toBe('https://gulumen.b-cdn.net/products/https%3A%2F%2Fcdn.supplier.example%2Fmain.jpg.webp')
    expect(result.images?.[1]).toBe('https://gulumen.b-cdn.net/products/already.webp')
    expect(result.images?.[2]).toBe('/img/local.png')
    const colors = result.colorImages as { images: string[] }[]
    expect(colors[0].images[0]).toBe(result.image)
    expect(colors[0].images[1]).toContain('gulumen.b-cdn.net')
  })

  it('does nothing when every URL is already first-party', async () => {
    const ingestUrl = vi.fn()
    const result = await ingestProductImages(
      {
        slug: 'x',
        image: 'https://gulumen.b-cdn.net/a.webp',
        images: ['https://gulumen.b-cdn.net/a.webp'],
      },
      ingestUrl
    )
    expect(ingestUrl).not.toHaveBeenCalled()
    expect(result.ingestedCount).toBe(0)
    expect(result.image).toBe('https://gulumen.b-cdn.net/a.webp')
  })

  it('rejects oversized remote galleries', async () => {
    const images = Array.from(
      { length: MAX_REMOTE_IMAGES_PER_SAVE + 1 },
      (_, i) => `https://cdn.example/${i}.jpg`
    )
    await expect(ingestProductImages({ slug: 'x', images }, async () => 'nope')).rejects.toBeInstanceOf(
      RemoteImageIngestError
    )
  })
})
