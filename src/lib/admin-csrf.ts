/**
 * Admin CSRF: double-submit cookie + Origin ellenőrzés.
 * Edge-kompatibilis (middleware).
 */

import { ADMIN_SESSION_MAX_AGE_SEC } from '@/lib/admin-session-constants'
import { ADMIN_CSRF_COOKIE, ADMIN_CSRF_HEADER } from '@/lib/admin-csrf-constants'

export {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_REQUESTED_WITH_HEADER,
  ADMIN_REQUESTED_WITH_VALUE,
} from '@/lib/admin-csrf-constants'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}

export function getAdminCsrfCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SEC) {
  return {
    path: '/',
    maxAge,
    httpOnly: false,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

export function isMutatingMethod(method: string): boolean {
  return MUTATING.has(method.toUpperCase())
}

export function isAdminApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/admin/')
}

export function isAdminLoginApiPath(pathname: string): boolean {
  return pathname === '/api/admin/login'
}

function hostFromUrl(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Same-origin: Origin (vagy Referer) hostja egyezik a kérés Host fejlévével,
 * vagy a NEXT_PUBLIC_APP_URL hostjával.
 */
export function isTrustedAdminOrigin(request: Request): boolean {
  const host = (request.headers.get('host') || '').toLowerCase()
  const originHost = hostFromUrl(request.headers.get('origin'))
  const refererHost = hostFromUrl(request.headers.get('referer'))
  const appHost = hostFromUrl(process.env.NEXT_PUBLIC_APP_URL || null)

  const allowed = new Set<string>()
  if (host) allowed.add(host)
  if (appHost) allowed.add(appHost)

  if (originHost) return allowed.has(originHost)
  if (refererHost) return allowed.has(refererHost)

  // Fetch mindig küld Origin-t same-origin POST-nál. Hiányzó Origin productionben gyanús.
  return process.env.NODE_ENV !== 'production'
}

export type AdminCsrfDecision =
  | { ok: true; reason: 'not_mutating' | 'login' | 'api_key' | 'valid' }
  | { ok: false; reason: 'bad_origin' | 'missing_token' | 'mismatch' }

export function evaluateAdminCsrf(request: Request): AdminCsrfDecision {
  const method = request.method.toUpperCase()
  if (!isMutatingMethod(method)) return { ok: true, reason: 'not_mutating' }

  const pathname = new URL(request.url).pathname
  if (!isAdminApiPath(pathname)) return { ok: true, reason: 'not_mutating' }

  // Gépi hívás (x-admin-key): a kulcs maga a védelem; CSRF a böngészős sessionre vonatkozik.
  if (request.headers.get('x-admin-key')?.trim()) {
    return { ok: true, reason: 'api_key' }
  }

  if (!isTrustedAdminOrigin(request)) {
    return { ok: false, reason: 'bad_origin' }
  }

  // Login: még nincs session; Origin elég (a kulcsot CSRF-fel nem lehet kitalálni).
  if (isAdminLoginApiPath(pathname)) {
    return { ok: true, reason: 'login' }
  }

  const cookieHeader = request.headers.get('cookie') || ''
  const cookieMatch = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_CSRF_COOKIE}=([^;]*)`)
  )
  let cookieToken = ''
  if (cookieMatch?.[1]) {
    try {
      cookieToken = decodeURIComponent(cookieMatch[1])
    } catch {
      cookieToken = cookieMatch[1]
    }
  }
  const headerToken = request.headers.get(ADMIN_CSRF_HEADER)?.trim() || ''

  if (!cookieToken || !headerToken) {
    return { ok: false, reason: 'missing_token' }
  }
  if (!timingSafeEqualStr(cookieToken, headerToken)) {
    return { ok: false, reason: 'mismatch' }
  }
  return { ok: true, reason: 'valid' }
}
