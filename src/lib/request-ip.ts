/**
 * Kliens IP kinyerése proxy fejlécekből (x-forwarded-for, x-real-ip, cf-connecting-ip).
 * Edge-kompatibilis (middleware + Node).
 */

export function normalizeIp(raw: string): string {
  let ip = raw.trim()
  if (!ip) return ''

  if (ip.startsWith('[') && ip.includes(']')) {
    const end = ip.indexOf(']')
    const inner = ip.slice(1, end)
    const rest = ip.slice(end + 1)
    ip = rest.startsWith(':') ? inner : inner
  } else if ((ip.match(/:/g) || []).length === 1 && /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.replace(/:\d+$/, '')
  }

  if (ip.toLowerCase().startsWith('::ffff:')) {
    ip = ip.slice(7)
  }

  return ip.trim().toLowerCase()
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]
    const ip = normalizeIp(first || '')
    if (ip) return ip
  }

  const cf = request.headers.get('cf-connecting-ip')
  if (cf) {
    const ip = normalizeIp(cf)
    if (ip) return ip
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    const ip = normalizeIp(realIp)
    if (ip) return ip
  }

  return 'unknown'
}

/** ISO 3166-1 alpha-2 a CDN / edge geo headerből. XX/T1 (Cloudflare unknown/tor) kihagyva. */
export function getRequestCountryCode(request: Request): string | null {
  const raw =
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('x-country-code') ||
    request.headers.get('cloudfront-viewer-country') ||
    ''
  const code = raw.trim().toUpperCase()
  if (!code || code === 'XX' || code === 'T1' || !/^[A-Z]{2}$/.test(code)) return null
  return code
}

export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent')?.trim() || ''
}
