/**
 * Bunny CDN URL tisztítás és normalizálás.
 * Minden feltöltött / beillesztett / DB-ből kiolvasott képlink ezen megy át mentés és megjelenítés előtt.
 */

/** Letisztult placeholder – törött böngészőikon helyett. */
export const PLACEHOLDER_IMAGE = '/img/placeholder-product.svg'

const STORAGE_HOST_RE = /^(?:https?:)?\/\/(?:[a-z0-9-]+\.)?storage\.bunnycdn\.com/i
const DOUBLE_SLASH_RE = /([^:]\/)\/+/g
/** Host név protokoll nélkül, pl. gulumen.b-cdn.net/kuka/foto.jpg */
const HOST_WITHOUT_PROTOCOL_RE =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/:?#]|$)/i

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
 * Storage Zone neve (pl. gulumen).
 * Kliensen is elérhető NEXT_PUBLIC_ változat kell a path tisztításhoz.
 */
export function getStorageZoneName(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_BUNNY_STORAGE_ZONE?.trim() ||
    process.env.BUNNY_STORAGE_ZONE?.trim()
  if (fromEnv) return fromEnv
  // Alapértelmezés: a pull zone host első címkéje (gulumen.b-cdn.net → gulumen)
  const host = getCdnHost()
  const first = host.split('.')[0]?.trim()
  return first || 'gulumen'
}

/**
 * Eltávolítja a Storage Zone nevet a path elejéről.
 * storage.bunnycdn.com/gulumen/kuka/x.jpg → /kuka/x.jpg
 * gulumen.b-cdn.net/gulumen/kuka/x.jpg → /kuka/x.jpg (hibásan bemásolt link)
 */
function stripStorageZonePrefix(pathname: string): string {
  const zone = getStorageZoneName()
  if (!zone) return pathname
  const lower = pathname.toLowerCase()
  const prefix = `/${zone.toLowerCase()}/`
  if (lower.startsWith(prefix)) {
    return pathname.slice(zone.length + 1) || '/'
  }
  if (lower === `/${zone.toLowerCase()}`) {
    return '/'
  }
  return pathname
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

/** Abszolút URL-t mindig https:// protokollal ad vissza (http → https). */
function ensureHttpsAbsoluteUrl(parsed: URL): string {
  const protocol = 'https:'
  let path = parsed.pathname.replace(DOUBLE_SLASH_RE, '$1')
  path = encodePathPreservingSlashes(path)
  return `${protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`
}

/**
 * Univerzális CDN URL tisztító:
 * 1. Hiányzó protokoll → https:// eléillesztése (pl. gulumen.b-cdn.net/... → https://...)
 * 2. storage.bunnycdn.com → Pull Zone / CDN host
 * 3. Dupla perjelek eltávolítása a protokoll után
 * 4. Fájlnév szóköz / ékezet / speciális karakter encode
 * Relatív helyi path (/uploads/..., /img/...) változatlanul marad.
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

  // Host protokoll nélkül: gulumen.b-cdn.net/kuka/foto.jpg → https://gulumen.b-cdn.net/...
  if (!/^https?:\/\//i.test(url) && HOST_WITHOUT_PROTOCOL_RE.test(url)) {
    url = `https://${url}`
  }

  // storage.bunnycdn.com → CDN pull zone (path: /{zone}/{file} → /{file})
  if (STORAGE_HOST_RE.test(url)) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url.replace(/^\/+/, '')}`)
      const path = stripStorageZonePrefix(parsed.pathname || '/')
      url = `${getCdnBaseUrl()}${path}${parsed.search}${parsed.hash}`
    } catch {
      url = url.replace(STORAGE_HOST_RE, getCdnBaseUrl())
    }
  }

  // Már CDN host, vagy egyéb abszolút URL — kimenet mindig https://
  try {
    const parsed = new URL(url)
    // Ha valaki a zone nevet is bemásolta a pull zone URL-be, vágjuk le
    const cdnHost = getCdnHost().toLowerCase()
    if (parsed.hostname.toLowerCase() === cdnHost || parsed.hostname.toLowerCase().endsWith('.b-cdn.net')) {
      parsed.pathname = stripStorageZonePrefix(parsed.pathname || '/')
    }
    return ensureHttpsAbsoluteUrl(parsed)
  } catch {
    // Nem érvényes abszolút URL – path-ként a CDN pull zone alá
    const cleaned = url.replace(/^\/+/, '').replace(/\/{2,}/g, '/')
    if (!cleaned) return ''
    if (/^https?:\/\//i.test(cleaned)) {
      try {
        return ensureHttpsAbsoluteUrl(new URL(cleaned))
      } catch {
        return cleaned.replace(/^http:\/\//i, 'https://')
      }
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

export type CdnImageSizeOptions = {
  /** Cél szélesség px-ben (Bunny Optimizer / Dynamic Images API). */
  width: number
  /** Opcionális magasság. */
  height?: number
  /** JPEG/WebP minőség 1–100 (alap: 75). */
  quality?: number
}

function isBunnyPullZoneUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    return host.endsWith('.b-cdn.net') || host === getCdnHost().toLowerCase()
  } catch {
    return false
  }
}

/**
 * Kis / közepes méretű CDN kép URL (Bunny Optimizer query).
 * Relatív (/uploads, /img) és nem-Bunny URL-eket változatlanul adja vissza.
 * Thumbnail: width ≈ 160 (80px doboz, 2× retina) → pár KB helyett MB.
 */
export function cdnSizedUrl(
  input: string | null | undefined,
  options: CdnImageSizeOptions
): string {
  const cleaned = cleanCdnUrl(input)
  if (!cleaned || cleaned === PLACEHOLDER_IMAGE) return cleaned
  if (!isBunnyPullZoneUrl(cleaned)) return cleaned

  const width = Math.max(1, Math.floor(options.width))
  try {
    const parsed = new URL(cleaned)
    parsed.searchParams.set('width', String(width))
    if (options.height != null && options.height > 0) {
      parsed.searchParams.set('height', String(Math.floor(options.height)))
    }
    const quality =
      options.quality != null
        ? Math.min(100, Math.max(1, Math.floor(options.quality)))
        : 75
    parsed.searchParams.set('quality', String(quality))
    return parsed.toString()
  } catch {
    return cleaned
  }
}

/** Galéria thumbnail (80px UI, retina). */
export function cdnThumbnailUrl(input: string | null | undefined): string {
  return cdnSizedUrl(input, { width: 160, height: 160, quality: 70 })
}

/**
 * Termékkártya / lista kép (1 oszlop mobilon ~100vw, retina).
 * Feltöltött, több MB-os eredetik helyett méretezett CDN URL – iOS memóriában is megjelenik.
 */
export function cdnCardUrl(input: string | null | undefined): string {
  const cleaned = cleanCdnUrl(input)
  if (!cleaned) return PLACEHOLDER_IMAGE
  return cdnSizedUrl(cleaned, { width: 800, quality: 75 })
}

/** Termékoldal fő kép (viewport, nem teljes eredeti MB). */
export function cdnGalleryMainUrl(input: string | null | undefined): string {
  return cdnSizedUrl(input, { width: 1200, quality: 82 })
}

/** Bunny Storage feltöltés konfigurálva van-e. */
export function isBunnyUploadConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STORAGE_ZONE?.trim() &&
      process.env.BUNNY_STORAGE_API_KEY?.trim()
  )
}
