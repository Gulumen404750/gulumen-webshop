/**
 * Első féltől származó (saját domain / Bunny CDN) termékkép URL-ek
 * a Product JSON-LD-hez és a sitemaphez. Külső hotlink nem kerül bele.
 */
import { getCdnHost, isBunnyPullZoneUrl, isBunnyStorageHost } from '@/lib/cdn'
import { buildProductGallery, isValidImageUrl, normalizeImageUrl } from '@/lib/product-images'
import { normalizeColorVariants } from '@/lib/filamentColors'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gulumen.com').replace(/\/$/, '')

const STATIC_FIRST_PARTY_HOSTS = new Set([
  'www.gulumen.com',
  'gulumen.com',
  'gulumen.hu',
  'www.gulumen.hu',
  'gulumen.b-cdn.net',
])

function appUrlHost(): string | null {
  try {
    return new URL(BASE_URL).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isFirstPartyImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (STATIC_FIRST_PARTY_HOSTS.has(host)) return true
  const cdn = getCdnHost().toLowerCase()
  if (host === cdn || host.endsWith('.b-cdn.net')) return true
  if (isBunnyStorageHost(host)) return true
  const appHost = appUrlHost()
  if (appHost && host === appHost) return true
  return false
}

/** Relatív shop path vagy saját CDN/domain – JSON-LD / sitemap számára. */
export function isFirstPartyImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return isValidImageUrl(trimmed)
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    if (isBunnyPullZoneUrl(trimmed)) return true
    return isFirstPartyImageHost(parsed.hostname)
  } catch {
    return false
  }
}

export function toAbsoluteFirstPartyImageUrl(url: string): string | null {
  const normalized = normalizeImageUrl(url)
  if (!isFirstPartyImageUrl(normalized)) return null
  if (normalized.startsWith('/')) return `${BASE_URL}${normalized}`
  try {
    const parsed = new URL(normalized)
    parsed.hash = ''
    parsed.search = ''
    return parsed.toString()
  } catch {
    return null
  }
}

type ProductImageSource = {
  image?: string | null
  images?: string[] | null
  colorImages?: unknown
}

/**
 * Fő kép + galéria + színvariációk első féltől származó abszolút URL-jei.
 * 360° kockák szándékosan kimaradnak (sitemap zaj).
 */
export function absoluteFirstPartyProductImages(
  product: ProductImageSource,
  limit = 12
): string[] {
  const gallery = buildProductGallery(product.image, product.images)
  const colorVariants = normalizeColorVariants(product.colorImages)
  const extra = colorVariants.flatMap((v) => v.images)
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...gallery, ...extra]) {
    const abs = toAbsoluteFirstPartyImageUrl(raw)
    if (!abs || seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
    if (out.length >= limit) break
  }
  return out
}
