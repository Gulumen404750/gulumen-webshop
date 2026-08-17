/**
 * Külső https kép letöltése SSRF-védelemmel, majd WebP + saját CDN.
 */
import { createHash } from 'crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import { isBunnyPullZoneUrl, isBunnyStorageHost } from '@/lib/cdn'
import { isFirstPartyImageUrl } from '@/lib/product-image-urls'
import { optimizeImageToWebp, persistOptimizedWebp, MAX_IMAGE_INPUT_SIZE } from '@/lib/image-optimize'
import { slugifyProduct } from '@/lib/slug'

export const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 12_000
export const REMOTE_IMAGE_MAX_REDIRECTS = 3
export const REMOTE_IMAGE_USER_AGENT =
  'GulumenImageIngest/1.0 (+https://www.gulumen.com; product image import)'

const ALLOWED_PORTS = new Set([80, 443])

export class RemoteImageIngestError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'ssrf'
      | 'fetch'
      | 'too_large'
      | 'not_image'
      | 'decode'
      | 'upload'
      | 'unsupported',
    readonly sourceUrl?: string
  ) {
    super(message)
    this.name = 'RemoteImageIngestError'
  }
}

export type DnsLookupFn = (hostname: string) => Promise<string[]>

export async function defaultDnsLookup(hostname: string): Promise<string[]> {
  const results = await dns.lookup(hostname, { all: true, verbatim: true })
  return results.map((r) => r.address)
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3]
}

function inCidr(ipInt: number, base: string, bits: number): boolean {
  const baseInt = ipv4ToInt(base)
  if (baseInt == null) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

/** Loopback, private, link-local, CGNAT, metadata. */
export function isBlockedIpAddress(ip: string): boolean {
  const raw = ip.trim().toLowerCase()
  if (!raw) return true

  if (raw.startsWith('::ffff:')) {
    return isBlockedIpAddress(raw.slice(7))
  }

  if (net.isIPv4(raw)) {
    const n = ipv4ToInt(raw)
    if (n == null) return true
    if (inCidr(n, '0.0.0.0', 8)) return true
    if (inCidr(n, '10.0.0.0', 8)) return true
    if (inCidr(n, '127.0.0.0', 8)) return true
    if (inCidr(n, '169.254.0.0', 16)) return true
    if (inCidr(n, '172.16.0.0', 12)) return true
    if (inCidr(n, '192.168.0.0', 16)) return true
    if (inCidr(n, '100.64.0.0', 10)) return true
    if (inCidr(n, '192.0.2.0', 24)) return true
    if (inCidr(n, '198.18.0.0', 15)) return true
    if (inCidr(n, '198.51.100.0', 24)) return true
    if (inCidr(n, '203.0.113.0', 24)) return true
    if (inCidr(n, '224.0.0.0', 4)) return true
    if (inCidr(n, '255.255.255.255', 32)) return true
    return false
  }

  if (net.isIPv6(raw)) {
    if (raw === '::' || raw === '::1') return true
    const compact = raw.replace(/^0+/, '') || raw
    if (compact.startsWith('fc') || compact.startsWith('fd') || raw.startsWith('fc') || raw.startsWith('fd')) {
      return true
    }
    if (raw.startsWith('fe80:') || raw.startsWith('fe8') || raw.startsWith('fe9') || raw.startsWith('fea') || raw.startsWith('feb')) {
      return true
    }
    return false
  }

  return true
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === 'metadata.google.internal') return true
  if (host.endsWith('.internal') || host.endsWith('.local') || host.endsWith('.lan')) return true
  if (net.isIP(host) && isBlockedIpAddress(host)) return true
  return false
}

function portOf(parsed: URL): number {
  if (parsed.port) return Number(parsed.port)
  if (parsed.protocol === 'https:') return 443
  if (parsed.protocol === 'http:') return 80
  return -1
}

export function parseRemoteImageUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    throw new RemoteImageIngestError('Érvénytelen kép URL.', 'unsupported', raw)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new RemoteImageIngestError('Csak http(s) kép URL tölthető le.', 'ssrf', raw)
  }
  if (parsed.username || parsed.password) {
    throw new RemoteImageIngestError('A kép URL nem tartalmazhat bejelentkezési adatot.', 'ssrf', raw)
  }
  if (!ALLOWED_PORTS.has(portOf(parsed))) {
    throw new RemoteImageIngestError('A kép URL csak a 80/443-as portot használhatja.', 'ssrf', raw)
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new RemoteImageIngestError('Ez a kép URL belső hálózatra mutat, ezért nem tölthető le.', 'ssrf', raw)
  }
  return parsed
}

export async function assertSafeRemoteImageUrl(
  raw: string,
  lookup: DnsLookupFn = defaultDnsLookup
): Promise<URL> {
  const parsed = parseRemoteImageUrl(raw)
  if (net.isIP(parsed.hostname)) {
    if (isBlockedIpAddress(parsed.hostname)) {
      throw new RemoteImageIngestError('Ez a kép URL belső hálózatra mutat, ezért nem tölthető le.', 'ssrf', raw)
    }
    return parsed
  }
  let addresses: string[]
  try {
    addresses = await lookup(parsed.hostname)
  } catch {
    throw new RemoteImageIngestError(
      `A kép hostja nem oldható fel: ${parsed.hostname}`,
      'fetch',
      raw
    )
  }
  if (!addresses.length || addresses.some((ip) => isBlockedIpAddress(ip))) {
    throw new RemoteImageIngestError('Ez a kép URL belső hálózatra mutat, ezért nem tölthető le.', 'ssrf', raw)
  }
  return parsed
}

/**
 * Már saját CDN / shop URL – ne töltsük le újra.
 * Relatív path, blob/data, saját domain.
 */
export function shouldIngestRemoteImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return false
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false
  if (isFirstPartyImageUrl(trimmed)) return false
  if (isBunnyPullZoneUrl(trimmed)) return false
  try {
    const parsed = new URL(trimmed)
    if (isBunnyStorageHost(parsed.hostname)) return false
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function looksLikeImage(contentType: string | null, url: string, buffer: Buffer): boolean {
  const type = (contentType || '').toLowerCase()
  if (type.startsWith('image/')) return true
  if (type.includes('octet-stream') || type === '' || type === 'application/octet-stream') {
    return /\.(jpe?g|png|webp|gif|avif|heic|heif)(\?|#|$)/i.test(url) || buffer.length > 24
  }
  return false
}

export type FetchRemoteImageDeps = {
  lookup?: DnsLookupFn
  fetchFn?: typeof fetch
}

async function fetchWithRedirects(
  startUrl: string,
  deps: FetchRemoteImageDeps = {}
): Promise<{ buffer: Buffer; contentType: string | null; finalUrl: string }> {
  const fetchFn = deps.fetchFn ?? fetch
  const lookup = deps.lookup ?? defaultDnsLookup
  let current = startUrl

  for (let hop = 0; hop <= REMOTE_IMAGE_MAX_REDIRECTS; hop++) {
    const safe = await assertSafeRemoteImageUrl(current, lookup)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REMOTE_IMAGE_FETCH_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetchFn(safe.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
          'User-Agent': REMOTE_IMAGE_USER_AGENT,
        },
      })
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      throw new RemoteImageIngestError(
        aborted
          ? `A kép letöltése időtúllépés miatt megszakadt: ${safe.hostname}`
          : `A kép nem tölthető le: ${safe.hostname}`,
        'fetch',
        startUrl
      )
    } finally {
      clearTimeout(timer)
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) {
        throw new RemoteImageIngestError('A kép URL átirányítása érvénytelen.', 'fetch', startUrl)
      }
      current = new URL(location, safe).toString()
      continue
    }

    if (!res.ok) {
      throw new RemoteImageIngestError(
        `A kép nem tölthető le (${res.status}): ${safe.hostname}`,
        'fetch',
        startUrl
      )
    }

    const lenHeader = res.headers.get('content-length')
    if (lenHeader && Number(lenHeader) > MAX_IMAGE_INPUT_SIZE) {
      throw new RemoteImageIngestError(
        `A kép mérete legfeljebb ${Math.round(MAX_IMAGE_INPUT_SIZE / 1024 / 1024)} MB lehet.`,
        'too_large',
        startUrl
      )
    }

    const raw = Buffer.from(await res.arrayBuffer())
    if (raw.length > MAX_IMAGE_INPUT_SIZE) {
      throw new RemoteImageIngestError(
        `A kép mérete legfeljebb ${Math.round(MAX_IMAGE_INPUT_SIZE / 1024 / 1024)} MB lehet.`,
        'too_large',
        startUrl
      )
    }
    if (raw.length < 24) {
      throw new RemoteImageIngestError('A letöltött fájl nem tűnik képnek.', 'not_image', startUrl)
    }

    const contentType = res.headers.get('content-type')
    if (!looksLikeImage(contentType, safe.toString(), raw)) {
      throw new RemoteImageIngestError(
        'A megadott URL nem képet adott vissza (pl. HTML oldal). Ellenőrizd a közvetlen kép-linket.',
        'not_image',
        startUrl
      )
    }

    return { buffer: raw, contentType, finalUrl: safe.toString() }
  }

  throw new RemoteImageIngestError('A kép URL túl sok átirányítást adott.', 'fetch', startUrl)
}

export function ingestedImageFilename(sourceUrl: string, slug?: string): string {
  const hash = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 12)
  const slugPart = slugifyProduct(slug || 'product').slice(0, 48)
  return `${slugPart}-${hash}.webp`
}

export type IngestRemoteImageDeps = FetchRemoteImageDeps & {
  persist?: typeof persistOptimizedWebp
  optimize?: typeof optimizeImageToWebp
}

export async function ingestRemoteImageUrl(
  sourceUrl: string,
  options: { slug?: string } = {},
  deps: IngestRemoteImageDeps = {}
): Promise<string> {
  const { buffer, finalUrl } = await fetchWithRedirects(sourceUrl, deps)
  const optimize = deps.optimize ?? optimizeImageToWebp
  let webp: Buffer
  try {
    webp = await optimize(buffer)
  } catch {
    throw new RemoteImageIngestError(
      'A letöltött fájl nem olvasható kép. Használj közvetlen JPG/PNG/WebP linket.',
      'decode',
      sourceUrl
    )
  }

  const filename = ingestedImageFilename(finalUrl, options.slug)
  const persist = deps.persist ?? persistOptimizedWebp
  try {
    const stored = await persist(filename, webp, { allowLocalFallback: process.env.NODE_ENV !== 'production' })
    return stored.url
  } catch (err) {
    if (err instanceof RemoteImageIngestError) throw err
    const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
    throw new RemoteImageIngestError(msg, 'upload', sourceUrl)
  }
}
