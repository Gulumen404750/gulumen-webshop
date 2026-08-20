import type { Product } from '@/lib/data'
import { getProductDescription, getProductName } from '@/lib/data'
import { foldAccents } from '@/lib/slug'

function productSearchHaystack(product: Product, locale: string): string {
  const raw = [
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
  const folded = foldAccents(raw)
  // Bindókötőjel a slugban (asztali-lampa) ugyanúgy token, mint a szóköz.
  return `${folded} ${folded.replace(/[-_/]+/g, ' ')}`
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

  const hayTokens = hay.split(/[^a-z0-9]+/).filter((w) => w.length >= 2)
  const tokensMatch = words.every((w) =>
    hayTokens.some((token) => {
      if (token === w) return true
      if (w.length >= 3 && token.startsWith(w)) return true
      if (token.length >= 4 && w.startsWith(token) && w.length - token.length <= 1) return true
      return false
    })
  )
  if (words.length >= 1 && tokensMatch) return true

  if (q.length >= 3 && (hay.includes(q.slice(0, -1)) || hay.includes(q.slice(1)))) return true
  return false
}
