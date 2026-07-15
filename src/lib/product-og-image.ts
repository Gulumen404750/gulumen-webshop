import type { Product } from '@/lib/data'
import { isSaleActive } from '@/lib/storefront-config'

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

export function getProductOgImagePath(slug: string): string {
  return `/termek/${encodeURIComponent(slug)}/opengraph-image`
}

export function getProductOgImageUrl(slug: string): string {
  return `${BASE_URL}${getProductOgImagePath(slug)}`
}

export function toAbsoluteAssetUrl(path: string | undefined | null): string {
  const fallback = `${BASE_URL}/img/logo.png`
  if (!path?.trim()) return fallback
  const trimmed = path.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `${BASE_URL}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
}

export function getProductDisplayPriceHuf(product: Product, now: Date = new Date()): number {
  if (isSaleActive(product, now) && product.discountPriceHuf != null) {
    return product.discountPriceHuf
  }
  return product.priceHuf
}

export function formatHufPrice(amount: number): string {
  return `${amount.toLocaleString('hu-HU')} Ft`
}

export function truncateProductName(name: string, maxLength = 72): string {
  if (name.length <= maxLength) return name
  return `${name.slice(0, maxLength - 1).trimEnd()}…`
}
