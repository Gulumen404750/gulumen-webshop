import type { Product } from '@/lib/data'
import { getProductDescription, getProductName } from '@/lib/data'
import { foldAccents } from '@/lib/slug'

function productSearchHaystack(product: Product, locale: string): string {
  return foldAccents(
    [
      getProductName(product, locale),
      getProductDescription(product, locale) ?? '',
      product.name,
      product.nameEn,
      product.nameDe ?? '',
      product.nameRo ?? '',
      product.slug,
      product.category,
      product.description,
      product.description_hu ?? '',
      product.description_en ?? '',
      product.description_de ?? '',
      product.description_ro ?? '',
    ].join(' ')
  )
}

/**
 * Storefront termékkereső: ékezetfüggetlen, kis/nagybetű-független.
 * „lampa” és „lámpa” ugyanazt a találatot adja.
 */
export function matchesProductSearch(product: Product, search: string, locale: string): boolean {
  const q = foldAccents(search).replace(/\s+/g, ' ').trim()
  if (!q) return true

  const hay = productSearchHaystack(product, locale)
  if (hay.includes(q)) return true

  const words = q.split(' ').filter(Boolean)
  if (words.length > 1 && words.every((w) => hay.includes(w))) return true

  if (q.length >= 3 && (hay.includes(q.slice(0, -1)) || hay.includes(q.slice(1)))) return true
  return false
}
