/**
 * Termékkép URL-ek tisztítása és galéria összeállítása.
 */

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

/** Protokoll-relatív és whitespace URL-ek normalizálása. */
export function normalizeImageUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed
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
