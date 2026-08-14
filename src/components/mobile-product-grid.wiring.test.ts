import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('mobile product grid wiring', () => {
  it('does not trap document scroll with overflow-x on html/body', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf-8')
    expect(css).not.toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*clip/)
    expect(css).not.toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/)
  })

  it('does not make main a nested overflow scroll container', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf-8')
    expect(layout).toMatch(/<main className="flex-1 min-w-0">/)
    expect(layout).not.toMatch(/<main className="[^"]*overflow-x-hidden/)
  })

  it('shop and featured grids stay 1 column on mobile with min-w-0 items', () => {
    const shop = readFileSync(join(process.cwd(), 'src/components/ShopContent.tsx'), 'utf-8')
    expect(shop).toMatch(/grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/)
    expect(shop).toMatch(/ProductStaggerItem/)

    const featured = readFileSync(
      join(process.cwd(), 'src/components/FeaturedProductsGrid.tsx'),
      'utf-8'
    )
    expect(featured).toMatch(/grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/)
    expect(featured).toMatch(/ProductStaggerItem/)

    const stagger = readFileSync(join(process.cwd(), 'src/components/ProductStaggerItem.tsx'), 'utf-8')
    expect(stagger).toMatch(/min-w-0 w-full/)
  })

  it('product cards use sized CDN URLs and a full-width square image box', () => {
    const card = readFileSync(join(process.cwd(), 'src/components/ProductCard.tsx'), 'utf-8')
    expect(card).toMatch(/cdnCardUrl/)
    expect(card).toMatch(/getGalleryImagesForColor/)
    expect(card).toMatch(/relative w-full aspect-square/)
    expect(card).toMatch(/min-w-0 w-full/)
  })
})
