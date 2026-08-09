/**
 * Kosár sor megjelenítés: élő termékadat + kosárba tételkor mentett snapshot.
 * Ha a ProductsContext még nem töltődött / a termék hiányzik, a snapshot
 * biztosítja a nevet, árat és képet (ne jelenjen meg nyers ID / 0 Ft).
 */

import type { Product } from '@/lib/data'
import { getProductName } from '@/lib/data'
import {
  getBaseColorVariant,
  getGalleryImagesForColor,
  normalizeColorVariants,
  normalizeHexColor,
} from '@/lib/filamentColors'
import { cleanCdnUrl, PLACEHOLDER_IMAGE, resolveImageUrl } from '@/lib/cdn'
import type { CartItem, CartItemOptions } from '@/lib/cart-storage'

/** Kosárba mentett megjelenítési mezők. */
export type CartItemSnapshotFields = {
  name?: string
  nameEn?: string
  nameDe?: string
  nameRo?: string
  /** Egységár HUF-ban a kosárba tételkor (discount árral, ha van). */
  priceHuf?: number
  /** Kiválasztott szín / alaptermék kép URL. */
  image?: string
}

export type ResolvedCartLine = {
  productId: string
  qty: number
  options?: CartItemOptions
  name: string
  priceHuf: number
  image: string
  product?: Product
}

function looksLikeCuidOrId(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  // Prisma cuid: cmskymdcz0000ph3itkhmb5tg
  if (/^c[a-z0-9]{20,}$/i.test(v)) return true
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
    return true
  }
  return false
}

function snapshotName(item: CartItemSnapshotFields, locale: string): string {
  switch (locale) {
    case 'hu':
      return (item.name || '').trim()
    case 'en':
      return (item.nameEn || item.name || '').trim()
    case 'de':
      return (item.nameDe || item.nameEn || item.name || '').trim()
    case 'ro':
      return (item.nameRo || item.nameEn || item.name || '').trim()
    default:
      return (item.nameEn || item.name || '').trim()
  }
}

/** Színvariáns kép, különben alaptermék / galéria első képe. */
export function resolveCartItemImage(
  product: Product,
  options?: CartItemOptions
): string {
  const variants = normalizeColorVariants(product.colorImages)
  let colorId: string | undefined

  if (options?.colorHex) {
    const hex = normalizeHexColor(options.colorHex, '')
    if (hex) {
      colorId = variants.find((v) => v.hex.toLowerCase() === hex.toLowerCase())?.id
    }
  }
  if (!colorId && options?.colorName) {
    const n = options.colorName.trim().toLowerCase()
    colorId = variants.find(
      (v) =>
        v.name.toLowerCase() === n ||
        v.id.toLowerCase() === n ||
        (v.nameEn && v.nameEn.toLowerCase() === n)
    )?.id
  }

  // Nincs színválasztás → alaptermék galériája, majd termék fő kép
  if (!colorId) {
    const base = getBaseColorVariant(product.colorImages)
    if (base?.images?.length) {
      return cleanCdnUrl(base.images[0])
    }
  }

  const gallery = getGalleryImagesForColor(product, colorId)
  const raw = gallery[0] || product.image || product.images?.[0] || ''
  return cleanCdnUrl(raw)
}

/** Snapshot mezők a kosárba tételkor. */
export function buildCartItemSnapshot(
  product: Product,
  options?: CartItemOptions
): CartItemSnapshotFields {
  const unit = product.discountPriceHuf ?? product.priceHuf
  const priceHuf = Number.isFinite(unit) ? Math.max(0, Math.round(unit)) : 0
  return {
    name: (product.name || '').trim() || undefined,
    nameEn: (product.nameEn || '').trim() || undefined,
    nameDe: (product.nameDe || '').trim() || undefined,
    nameRo: (product.nameRo || '').trim() || undefined,
    priceHuf,
    image: resolveCartItemImage(product, options) || undefined,
  }
}

/**
 * Megjelenítési adatok: élő termék elsőbbséget élvez, snapshot a fallback.
 * Kép mindig érvényes URL (placeholder ha hiányzik).
 */
export function resolveCartLine(
  item: CartItem,
  product: Product | undefined,
  locale: string
): ResolvedCartLine {
  let name = ''
  if (product) {
    name = getProductName(product, locale)
    if (!name || looksLikeCuidOrId(name) || name === product.id) {
      name = snapshotName(item, locale) || name
    }
  } else {
    name = snapshotName(item, locale)
  }
  if (!name || looksLikeCuidOrId(name)) {
    name = snapshotName(item, locale) || 'Termék'
  }

  let priceHuf = 0
  if (product) {
    const live = product.discountPriceHuf ?? product.priceHuf
    if (Number.isFinite(live) && live > 0) priceHuf = Math.round(live)
    else if (item.priceHuf != null && item.priceHuf > 0) priceHuf = Math.round(item.priceHuf)
    else if (Number.isFinite(live)) priceHuf = Math.max(0, Math.round(live))
  } else if (item.priceHuf != null && Number.isFinite(item.priceHuf)) {
    priceHuf = Math.max(0, Math.round(item.priceHuf))
  }

  let image = ''
  if (product) {
    image = resolveCartItemImage(product, item.options)
  }
  if (!image) {
    image = cleanCdnUrl(item.image || '')
  }
  image = resolveImageUrl(image || PLACEHOLDER_IMAGE)

  return {
    productId: item.productId,
    qty: item.qty,
    options: item.options,
    name,
    priceHuf,
    image,
    product,
  }
}

/** Egységár: élő termék vagy snapshot. */
export function resolveCartLinePriceHuf(
  item: CartItem,
  product: Product | undefined
): number {
  if (product) {
    const live = product.discountPriceHuf ?? product.priceHuf
    if (Number.isFinite(live) && live > 0) return Math.round(live)
  }
  if (item.priceHuf != null && Number.isFinite(item.priceHuf) && item.priceHuf > 0) {
    return Math.round(item.priceHuf)
  }
  if (product) {
    const live = product.discountPriceHuf ?? product.priceHuf
    if (Number.isFinite(live)) return Math.max(0, Math.round(live))
  }
  return 0
}
