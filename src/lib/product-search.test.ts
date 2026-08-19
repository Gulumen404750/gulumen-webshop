import { describe, expect, it } from 'vitest'
import { matchesProductSearch } from './product-search'
import type { Product } from './data'

function product(overrides: Partial<Product> & Pick<Product, 'name'>): Product {
  return {
    id: 'p1',
    nameEn: overrides.nameEn ?? overrides.name,
    slug: 'asztali-lampa',
    priceHuf: 1000,
    priceEur: 2.5,
    condition: 'Új',
    category: '3d-otthon',
    image: '/img/x.jpg',
    images: ['/img/x.jpg'],
    stock: 5,
    description: 'Asztali lámpa a nappaliba',
    ...overrides,
  }
}

describe('matchesProductSearch', () => {
  const lamp = product({ name: 'Asztali lámpa', nameEn: 'Desk lamp' })

  it('matches accented and unaccented queries the same way', () => {
    expect(matchesProductSearch(lamp, 'lámpa', 'hu')).toBe(true)
    expect(matchesProductSearch(lamp, 'lampa', 'hu')).toBe(true)
    expect(matchesProductSearch(lamp, 'LAMPA', 'hu')).toBe(true)
    expect(matchesProductSearch(lamp, 'Lámpa', 'en')).toBe(true)
  })

  it('matches Hungarian ő/ű folding', () => {
    const hanger = product({ name: 'Fűszertartó', slug: 'fuszertarto', description: '' })
    expect(matchesProductSearch(hanger, 'fuszertarto', 'hu')).toBe(true)
    expect(matchesProductSearch(hanger, 'fűszertartó', 'hu')).toBe(true)
  })

  it('does not match unrelated products', () => {
    const bag = product({ name: 'Vászon táska', slug: 'vaszon-taska', description: 'Táska' })
    expect(matchesProductSearch(bag, 'lampa', 'hu')).toBe(false)
  })
})
