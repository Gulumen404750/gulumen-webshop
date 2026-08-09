/**
 * Storefront láthatóság – kis kínálat mód, bővíthető később.
 * A teljes webshop motor változatlan; csak a megjelenítés szűr.
 */

import type { Product } from '@/lib/data'

/** Jelenleg látható fő kategória slug (nav + shop). */
export const STOREFRONT_VISIBLE_CATEGORY_SLUG = '3d-nyomtatott'

/** Ennél kevesebb terméknél a szűrő panel automatikusan elrejtődik. */
export const AUTO_HIDE_FILTERS_BELOW_COUNT = 6

/** Kezdőoldalon kiemelt termékek száma. */
export const FEATURED_PRODUCT_COUNT = 3

/** Kiemelt szekció: egy termék cseréje ennyi ms-onként (újdonság ↔ akció felváltva). */
export const FEATURED_ROTATION_MS = 2 * 60 * 1000

/** Mock módban aktív 3D termék ID-k (DB nélküli fejlesztéshez). */
export const MOCK_ACTIVE_3D_PRODUCT_IDS = [
  '3d-1', '3d-2', '3d-3',
  '3d-4', '3d-5', '3d-6', '3d-7', '3d-8', '3d-9', '3d-10',
  '3d-11', '3d-12', '3d-13', '3d-14', '3d-15', '3d-16', '3d-17', '3d-18',
  '3d-19', '3d-20', '3d-21', '3d-22', '3d-23', '3d-24', '3d-25', '3d-26', '3d-27', '3d-28',
] as const

function is3DCategory(category: string | undefined): boolean {
  return (category?.startsWith?.('3d-') ?? false)
}

export function isSaleActive(product: Product, now: Date = new Date()): boolean {
  if (!product.onSale || product.discountPriceHuf == null) return false
  const t = now.getTime()
  if (product.saleStartAt && t < new Date(product.saleStartAt).getTime()) return false
  if (product.saleEndAt && t > new Date(product.saleEndAt).getTime()) return false
  return true
}

export function getSaleDiscountPercent(product: Product): number | null {
  if (!product.discountPriceHuf || !product.priceHuf || product.priceHuf <= 0) return null
  return Math.round((1 - product.discountPriceHuf / product.priceHuf) * 100)
}

/** Storefront: csak aktív, nem archivált, nem időkorlátozott/beszerzéses termékek. */
export function isStorefrontVisible(product: Product): boolean {
  if (product.active === false) return false
  if (product.archived === true) return false
  if (product.type === 'sourcing_deal') return false
  return true
}

/** Mock fallback: csak a 3 kiemelt 3D termék látható. */
export function isMockStorefrontVisible(product: Product): boolean {
  if (product.type === 'sourcing_deal') return false
  if (is3DCategory(product.category)) {
    return MOCK_ACTIVE_3D_PRODUCT_IDS.includes(product.id as (typeof MOCK_ACTIVE_3D_PRODUCT_IDS)[number])
  }
  return false
}

export function filterStorefrontProducts(products: Product[], useMockFilter = false): Product[] {
  const visible = useMockFilter
    ? products.filter(isMockStorefrontVisible)
    : products.filter(isStorefrontVisible)
  return visible.map((p) => ({
    ...p,
    onSale: isSaleActive(p) ? p.onSale : false,
  }))
}

export function getFeaturedProducts(products: Product[], limit = FEATURED_PRODUCT_COUNT): Product[] {
  const stock3D = products.filter((p) => p.type !== 'sourcing_deal' && is3DCategory(p.category))
  return stock3D.slice(0, limit)
}

/** Időkorlátos akciók kikapcsolva – a boltban nincs akciós / limitált szekció. */
export function getActiveDealProducts(_products: Product[]): Product[] {
  return []
}

export function getNewProducts(products: Product[]): Product[] {
  return products.filter(
    (p) => p.isNew && p.type !== 'sourcing_deal' && isStorefrontVisible(p)
  )
}
