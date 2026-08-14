/**
 * Rejtett admin URL: ADMIN_URL_SLUG.
 * Ha be van állítva, a belépés /{slug}/login és az API /api/{slug}/* alatt él;
 * a nyilvános /admin és /api/admin session nélkül 404.
 */

export const ADMIN_URL_SLUG_ENV = 'ADMIN_URL_SLUG'
export const ADMIN_PUBLIC_BASE_COOKIE = 'g_admin_base'
export const CANONICAL_ADMIN_UI_PREFIX = '/admin'
export const CANONICAL_ADMIN_API_PREFIX = '/api/admin'

/** Shop / rendszer útvonalak, amikre a slug nem eshet. */
export const ADMIN_URL_RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'login',
  'logout',
  'dashboard',
  'akciok',
  'aszf',
  'beszerzesre-rendelheto',
  'fizetes',
  'gyik',
  'kapcsolat',
  'kedvencek',
  'kosar',
  'lejart-termekek',
  'macskavadaszat',
  'profil',
  'regisztracio',
  'szallitas',
  'termek',
  'termekek',
  'ujdonsagok',
  'visszakuldes',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'models',
  'health',
  'feed',
  'products',
  'cart',
  'checkout',
  'newsletter',
  'orders',
  'payments',
  'stripe',
  'me',
  'cron',
  'chat',
  'gamification',
  'loyalty',
  'deal-popup',
  'callback-request',
  'call-summary',
  'ai-voice',
])

const SLUG_RE = /^[a-z0-9][a-z0-9-]{6,62}[a-z0-9]$/

export type AdminPathMatch =
  | { kind: 'none' }
  | {
      kind: 'ui' | 'api'
      internalPath: string
      publicPath: string
      isCanonical: boolean
      isLogin: boolean
    }

export function parseAdminUrlSlug(raw: string | undefined | null): string | null {
  if (!raw) return null
  const slug = raw.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
  if (!SLUG_RE.test(slug)) return null
  if (ADMIN_URL_RESERVED_SLUGS.has(slug)) return null
  return slug
}

export function getAdminUrlSlug(env: Record<string, string | undefined> = process.env): string | null {
  return parseAdminUrlSlug(env.ADMIN_URL_SLUG)
}

export function publicAdminUiPath(internalPath: string, slug: string | null): string {
  if (!slug) return internalPath
  if (internalPath === CANONICAL_ADMIN_UI_PREFIX) return `/${slug}`
  if (internalPath.startsWith(`${CANONICAL_ADMIN_UI_PREFIX}/`)) {
    return `/${slug}${internalPath.slice(CANONICAL_ADMIN_UI_PREFIX.length)}`
  }
  return internalPath
}

export function publicAdminApiPath(internalPath: string, slug: string | null): string {
  if (!slug) return internalPath
  if (internalPath === CANONICAL_ADMIN_API_PREFIX) return `/api/${slug}`
  if (internalPath.startsWith(`${CANONICAL_ADMIN_API_PREFIX}/`)) {
    return `/api/${slug}${internalPath.slice(CANONICAL_ADMIN_API_PREFIX.length)}`
  }
  return internalPath
}

export function publicAdminUiPathFromBase(canonicalPath: string, base: string): string {
  if (!canonicalPath.startsWith(CANONICAL_ADMIN_UI_PREFIX)) return canonicalPath
  const rest = canonicalPath.slice(CANONICAL_ADMIN_UI_PREFIX.length)
  return rest ? `${base}${rest}` : base
}

export function safeAdminReturnPath(raw: string | null | undefined, slug: string | null): string {
  const fallback = publicAdminUiPath(`${CANONICAL_ADMIN_UI_PREFIX}/dashboard`, slug)
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('..')) {
    return fallback
  }
  const pathOnly = raw.split('?')[0] || ''
  const match = classifyAdminPath(pathOnly, slug)
  if (match.kind === 'ui' && !match.isLogin) return match.publicPath
  const parts = pathOnly.split('/').filter(Boolean)
  if (parts[0] && parseAdminUrlSlug(parts[0]) && parts[1] !== 'login') {
    return pathOnly
  }
  return fallback
}

export function parseAdminPublicBaseCookie(raw: string | undefined | null): string | null {
  if (!raw) return null
  let value = raw.trim()
  try {
    value = decodeURIComponent(value)
  } catch {
    /* already decoded */
  }
  if (!value.startsWith('/')) return null
  const slug = parseAdminUrlSlug(value.slice(1))
  return slug ? `/${slug}` : null
}

export function slugFromPublicBase(base: string): string | null {
  if (base === CANONICAL_ADMIN_UI_PREFIX) return null
  if (!base.startsWith('/')) return null
  return parseAdminUrlSlug(base.slice(1))
}

function restAfterPrefix(pathname: string, prefix: string): string | null {
  if (pathname === prefix) return ''
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  return null
}

function isUiLogin(internalPath: string): boolean {
  return internalPath === `${CANONICAL_ADMIN_UI_PREFIX}/login`
}

function isApiLogin(internalPath: string): boolean {
  return (
    internalPath === `${CANONICAL_ADMIN_API_PREFIX}/login` ||
    internalPath === `${CANONICAL_ADMIN_API_PREFIX}/2fa/verify-login`
  )
}

export function classifyAdminPath(pathname: string, slug: string | null): AdminPathMatch {
  const canonicalUiRest = restAfterPrefix(pathname, CANONICAL_ADMIN_UI_PREFIX)
  if (canonicalUiRest !== null) {
    const internalPath = `${CANONICAL_ADMIN_UI_PREFIX}${canonicalUiRest}`
    return {
      kind: 'ui',
      internalPath,
      publicPath: publicAdminUiPath(internalPath, slug),
      isCanonical: true,
      isLogin: isUiLogin(internalPath),
    }
  }

  const canonicalApiRest = restAfterPrefix(pathname, CANONICAL_ADMIN_API_PREFIX)
  if (canonicalApiRest !== null) {
    const internalPath = `${CANONICAL_ADMIN_API_PREFIX}${canonicalApiRest}`
    return {
      kind: 'api',
      internalPath,
      publicPath: publicAdminApiPath(internalPath, slug),
      isCanonical: true,
      isLogin: isApiLogin(internalPath),
    }
  }

  if (slug) {
    const publicUiRest = restAfterPrefix(pathname, `/${slug}`)
    if (publicUiRest !== null) {
      const internalPath = `${CANONICAL_ADMIN_UI_PREFIX}${publicUiRest}`
      return {
        kind: 'ui',
        internalPath,
        publicPath: pathname,
        isCanonical: false,
        isLogin: isUiLogin(internalPath),
      }
    }

    const publicApiRest = restAfterPrefix(pathname, `/api/${slug}`)
    if (publicApiRest !== null) {
      const internalPath = `${CANONICAL_ADMIN_API_PREFIX}${publicApiRest}`
      return {
        kind: 'api',
        internalPath,
        publicPath: pathname,
        isCanonical: false,
        isLogin: isApiLogin(internalPath),
      }
    }
  }

  return { kind: 'none' }
}

export function isAdminSurfacePath(pathname: string, slug: string | null = getAdminUrlSlug()): boolean {
  return classifyAdminPath(pathname, slug).kind !== 'none'
}

export function isAdminLoginPathname(pathname: string, slug: string | null = getAdminUrlSlug()): boolean {
  if (pathname === `${CANONICAL_ADMIN_UI_PREFIX}/login`) return true
  const match = classifyAdminPath(pathname, slug)
  if (match.kind === 'ui' && match.isLogin) return true
  const parts = pathname.split('/').filter(Boolean)
  return parts.length === 2 && parts[1] === 'login' && Boolean(parseAdminUrlSlug(parts[0]))
}

export type CanonicalAdminDecision = 'allow' | 'redirect-public' | 'hide' | 'not-admin'

/** Kanonikus /admin és /api/admin: session nélkül 404, UI-n bejelentkezve a rejtett URL-re. */
export function decideCanonicalAdminAccess(
  match: AdminPathMatch,
  opts: { slug: string | null; hasSession: boolean; hasApiKey: boolean }
): CanonicalAdminDecision {
  if (match.kind === 'none') return 'not-admin'
  if (!opts.slug || !match.isCanonical) return 'allow'
  if (match.kind === 'ui') {
    if (!opts.hasSession) return 'hide'
    return 'redirect-public'
  }
  if (opts.hasSession || opts.hasApiKey) return 'allow'
  return 'hide'
}

export function getAdminPublicBaseCookieOptions() {
  return {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}
