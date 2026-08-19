import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('shop search + empty results + heading wiring', () => {
  const shop = readFileSync(join(process.cwd(), 'src/components/ShopContent.tsx'), 'utf-8')
  const empty = readFileSync(
    join(process.cwd(), 'src/components/empty-states/SearchNoResultsEmptyState.tsx'),
    'utf-8'
  )
  const header = readFileSync(join(process.cwd(), 'src/components/Header.tsx'), 'utf-8')

  it('uses accent-insensitive product search', () => {
    expect(shop).toContain("import { matchesProductSearch } from '@/lib/product-search'")
    expect(shop).toContain('matchesProductSearch(p, searchQuery, locale)')
    expect(shop).not.toMatch(/function matchesSearch/)
  })

  it('does not show the 3D printed products page heading or subtitle', () => {
    expect(shop).toContain("const pageTitle = t('pages.productsTitle')")
    expect(shop).not.toContain('products3DSubtitle')
    expect(shop).not.toContain('HungarianFlagIcon')
    expect(shop).not.toContain('getStorefrontCategories')
    expect(header).not.toMatch(/getCategoryName\(threeDCat/)
    expect(shop).not.toContain('3D Nyomtatott')
  })

  it('searches the full catalog, not only the 3D category view', () => {
    expect(shop).toMatch(/if \(searchQuery\) return stockProducts/)
  })

  it('shows a no-results message and sale alternatives when search is empty', () => {
    expect(empty).toContain("t('search.noResultsTitle')")
    expect(shop).toContain('saleAlternatives')
    expect(shop).toContain("'search.saleAlternativesTitle'")
    expect(shop).toContain('isSaleActive(p)')
    expect(shop).toContain("'search.browseAlternativesTitle'")
  })
})
