/**
 * Bunny CDN URL tisztítás és normalizálás.
 * Minden feltöltött / beillesztett / DB-ből kiolvasott képlink ezen megy át mentés és megjelenítés előtt.
 */

/** Letisztult placeholder – törött böngészőikon helyett. */
export const PLACEHOLDER_IMAGE = '/img/placeholder-product.svg'

const STORAGE_HOST_RE = /^(?:https?:)?\/\/(?:[a-z0-9-]+\.)?storage\.bunnycdn\.com/i
const DOUBLE_SLASH_RE = /([^:]\/)\/+/g

/** Pull Zone host az env-ből (pl. gulumen.b-cdn.net). */
export function getCdnHost(): string {
  const raw =
    process.env.NEXT_PUBLIC_BUNNY_CDN_HOST ||
    process.env.BUNNY_CDN_HOST ||
    'gulumen.b-cdn.net'
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

/** Teljes CDN bázis URL (trailing slash nélkül). */
export function getCdnBaseUrl(): string {
  return `https://${getCdnHost()}`
}

/**
 * Path szegmensek biztonságos kódolása: szóköz, ékezet, speciális karakterek.
 * A / elválasztókat megtartja; a fájlnév/mappa részeket encodeURIComponent-tel kódolja.
 */
function encodePathPreservingSlashes(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return ''
      try {
        // Ha már kódolt, dekódoljuk majd újra kódoljuk (elkerüli a dupla encode-ot).
        const decoded = decodeURIComponent(segment)
        return encodeURIComponent(decoded)
      } catch {
        return encodeURIComponent(segment)
      }
    })
    .join('/')
}

/**
 * Univerzális CDN URL tisztító:
 * 1. storage.bunnycdn.com → Pull Zone / CDN host
 * 2. Dupla perjelek eltávolítása a protokoll után
 * 3. Fájlnév szóköz / ékezet / speciális karakter encode
 */
export function cleanCdnUrl(input: string | null | undefined): string {
  if (input == null) return ''
  let url = String(input).trim()
  if (!url) return ''

  // Relatív / helyi útvonalak (pl. /uploads/..., /img/...)
  if (url.startsWith('/') && !url.startsWith('//')) {
    // Dupla perjelek a path-ban
    url = url.replace(/\/{2,}/g, '/')
    const qIndex = url.indexOf('?')
    const hIndex = url.indexOf('#')
    let path = url
    let suffix = ''
    if (qIndex >= 0) {
      suffix = url.slice(qIndex)
      path = url.slice(0, qIndex)
    } else if (hIndex >= 0) {
      suffix = url.slice(hIndex)
      path = url.slice(0, hIndex)
    }
    const encoded = encodePathPreservingSlashes(path)
    return encoded + suffix
  }

  // Protocol-relative //host/...
  if (url.startsWith('//')) {
    url = `https:${url}`
  }

  // storage.bunnycdn.com → CDN pull zone (path: /{zone}/{file} → /{file} ha zone prefix)
  if (STORAGE_HOST_RE.test(url)) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https:${url}`)
      let path = parsed.pathname || '/'
      // Gyakori forma: /storageZoneName/folder/file.jpg → /folder/file.jpg
      const zone = process.env.BUNNY_STORAGE_ZONE?.trim()
      if (zone && path.toLowerCase().startsWith(`/${zone.toLowerCase()}/`)) {
        path = path.slice(zone.length + 1)
      } else if (zone && path.toLowerCase() === `/${zone.toLowerCase()}`) {
        path = '/'
      }
      url = `${getCdnBaseUrl()}${path}${parsed.search}${parsed.hash}`
    } catch {
      url = url.replace(STORAGE_HOST_RE, getCdnBaseUrl())
    }
  }

  // Már CDN host, vagy egyéb abszolút URL
  try {
    const parsed = new URL(url)
    // Dupla perjelek a path-ban (protokoll után)
    let path = parsed.pathname.replace(DOUBLE_SLASH_RE, '$1')
    path = encodePathPreservingSlashes(path)
    return `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`
  } catch {
    // Nem érvényes abszolút URL – próbáljuk meg path-ként / CDN-re rakni
    const cleaned = url.replace(/^\/+/, '').replace(/\/{2,}/g, '/')
    if (!cleaned) return ''
    if (/^https?:/i.test(cleaned) || cleaned.includes('://')) {
      return cleaned
    }
    const path = encodePathPreservingSlashes(`/${cleaned}`)
    return `${getCdnBaseUrl()}${path}`
  }
}

/** Tömb URL-ek tisztítása; üresek kiszűrése. */
export function cleanCdnUrls(urls: (string | null | undefined)[] | null | undefined): string[] {
  if (!urls?.length) return []
  return urls.map((u) => cleanCdnUrl(u)).filter(Boolean)
}

/** Megjelenítéshez: tisztított URL, vagy placeholder ha üres. */
export function resolveImageUrl(input: string | null | undefined): string {
  const cleaned = cleanCdnUrl(input)
  return cleaned || PLACEHOLDER_IMAGE
}

/** Bunny Storage feltöltés konfigurálva van-e. */
export function isBunnyUploadConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STORAGE_ZONE?.trim() &&
      process.env.BUNNY_STORAGE_API_KEY?.trim()
  )
}
