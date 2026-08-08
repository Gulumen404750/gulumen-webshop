/**
 * Termékkép URL-ek tisztítása és galéria összeállítása.
 */
import { cleanCdnUrl, cleanCdnUrls } from '@/lib/cdn'

/** Egy URL érvényes-e megjelenítéshez. */
export function isValidImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  const u = url.trim()
  if (!u) return false
  return (
    u.startsWith('/') ||
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('blob:') ||
    u.startsWith('data:image/')
  )
}

/** Protokoll-relatív, whitespace és CDN URL-ek normalizálása. */
export function normalizeImageUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  // blob:/data: ne menjen a CDN tisztítón
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed
  return cleanCdnUrl(trimmed)
}

/** Tömb tisztítása: trim, üres kiszűrése, duplikátumok eltávolítása (sorrend megmarad). */
export function normalizeImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    if (typeof raw !== 'string') continue
    const u = normalizeImageUrl(raw)
    if (!isValidImageUrl(u) || seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

/**
 * Galéria: images tömb + fő kép (ha hiányzik).
 * Üres / érvénytelen URL-ek kiszűrve.
 */
export function buildProductGallery(image: string | undefined | null, images: unknown): string[] {
  const gallery = normalizeImageUrls(images)
  const main = typeof image === 'string' ? normalizeImageUrl(image) : ''
  if (isValidImageUrl(main) && !gallery.includes(main)) {
    return [main, ...gallery]
  }
  if (gallery.length > 0) return gallery
  if (isValidImageUrl(main)) return [main]
  return []
}

/** Teljes képmező-csomag tisztítása (create / teljes replace). */
export function sanitizeProductImageFields(input: {
  image?: string | null
  images?: string[] | null
  images360?: string[] | null
}): { image: string; images: string[]; images360: string[] } {
  const image = cleanCdnUrl(input.image ?? '')
  const images = cleanCdnUrls(input.images)
  const images360 = cleanCdnUrls(input.images360)
  const gallery = images.length ? images : image ? [image] : []
  return { image: image || gallery[0] || '', images: gallery, images360 }
}

/** PATCH: csak a megadott mezőket tisztítja, a többit nem írja felül. */
export function sanitizeProductImagePatch(input: {
  image?: string | null
  images?: string[] | null
  images360?: string[] | null
}): {
  image?: string
  images?: string[]
  images360?: string[]
} {
  const out: { image?: string; images?: string[]; images360?: string[] } = {}
  if (input.image !== undefined) {
    out.image = cleanCdnUrl(input.image ?? '')
  }
  if (input.images !== undefined) {
    out.images = cleanCdnUrls(input.images)
    // Ha galériát mentünk, de nincs külön fő kép a patch-ben, a galéria első eleme legyen a fő
    if (input.image === undefined && out.images[0]) {
      out.image = out.images[0]
    }
  }
  if (input.images360 !== undefined) {
    out.images360 = cleanCdnUrls(input.images360)
  }
  return out
}

/** colorImages JSON: minden kép URL tisztítása. */
export function sanitizeColorImages(
  colorImages: unknown
): unknown {
  if (colorImages == null) return colorImages
  if (Array.isArray(colorImages)) {
    return colorImages.map((v) => {
      if (!v || typeof v !== 'object') return v
      const variant = v as Record<string, unknown>
      const images = Array.isArray(variant.images) ? cleanCdnUrls(variant.images as string[]) : variant.images
      return { ...variant, images }
    })
  }
  if (typeof colorImages === 'object') {
    const out: Record<string, string[]> = {}
    for (const [key, val] of Object.entries(colorImages as Record<string, unknown>)) {
      if (Array.isArray(val)) out[key] = cleanCdnUrls(val as string[])
    }
    return out
  }
  return colorImages
}
