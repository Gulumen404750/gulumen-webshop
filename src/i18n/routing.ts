import type { Locale } from './locales'
import { isValidLocale, LOCALES } from './locales'

/** SEO hreflang nyelvek (x-default = en). */
export const SEO_LOCALES = ['hu', 'en', 'de'] as const
export type SeoLocale = (typeof SEO_LOCALES)[number]

export const LOCALE_COOKIE = 'gulumen-locale'
export const LOCALE_HEADER = 'x-gulumen-locale'
export const PATHNAME_HEADER = 'x-gulumen-pathname'

/**
 * Útvonal kulcsok → nyelvspecifikus URL szegmensek.
 * A fájlrendszer / belső route mindig a magyar (hu) szegmenst használja.
 */
export const PATH_SEGMENTS = {
  products: { hu: 'termekek', en: 'products', de: 'produkte', ro: 'produse' },
  product: { hu: 'termek', en: 'product', de: 'produkt', ro: 'produs' },
  new: { hu: 'ujdonsagok', en: 'new', de: 'neuheiten', ro: 'noutati' },
  deals: { hu: 'akciok', en: 'deals', de: 'angebote', ro: 'oferte' },
  shipping: { hu: 'szallitas', en: 'shipping', de: 'versand', ro: 'livrare' },
  returns: { hu: 'visszakuldes', en: 'returns', de: 'rueckgabe', ro: 'returnari' },
  contact: { hu: 'kapcsolat', en: 'contact', de: 'kontakt', ro: 'contact' },
  cart: { hu: 'kosar', en: 'cart', de: 'warenkorb', ro: 'cos' },
  checkout: { hu: 'fizetes', en: 'checkout', de: 'kasse', ro: 'plata' },
  checkoutSuccess: { hu: 'siker', en: 'success', de: 'erfolg', ro: 'succes' },
  checkoutCancel: { hu: 'megszakitva', en: 'cancelled', de: 'abgebrochen', ro: 'anulata' },
  register: { hu: 'regisztracio', en: 'register', de: 'registrierung', ro: 'inregistrare' },
  profile: { hu: 'profil', en: 'profile', de: 'profil', ro: 'profil' },
  wishlist: { hu: 'kedvencek', en: 'wishlist', de: 'merkliste', ro: 'favorite' },
  sourcing: {
    hu: 'beszerzesre-rendelheto',
    en: 'sourcing',
    de: 'beschaffung',
    ro: 'aprovizionare',
  },
  expired: {
    hu: 'lejart-termekek',
    en: 'expired-products',
    de: 'abgelaufene-produkte',
    ro: 'produse-expirate',
  },
  faq: { hu: 'gyik', en: 'faq', de: 'faq', ro: 'faq' },
} as const

export type PathKey = keyof typeof PATH_SEGMENTS

/** Első szintű szegmens → path key (minden nyelven). */
const SEGMENT_TO_KEY: Record<string, PathKey> = {}
for (const [key, locales] of Object.entries(PATH_SEGMENTS) as [PathKey, Record<Locale, string>][]) {
  // Nested checkout keys are not top-level
  if (key === 'checkoutSuccess' || key === 'checkoutCancel') continue
  for (const seg of Object.values(locales)) {
    SEGMENT_TO_KEY[seg] = key
  }
}

const CHECKOUT_SUB_TO_KEY: Record<string, 'checkoutSuccess' | 'checkoutCancel'> = {}
for (const locale of LOCALES) {
  CHECKOUT_SUB_TO_KEY[PATH_SEGMENTS.checkoutSuccess[locale]] = 'checkoutSuccess'
  CHECKOUT_SUB_TO_KEY[PATH_SEGMENTS.checkoutCancel[locale]] = 'checkoutCancel'
}

/** Prefix nélküli útvonalak, amiket NEM lokalizálunk (admin, api, statikus). */
export function shouldSkipLocaleRouting(pathname: string): boolean {
  return (
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/models') ||
    pathname.startsWith('/img') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.endsWith('.xml') ||
    pathname.endsWith('.txt') ||
    pathname.endsWith('.json') ||
    /\.\w{2,5}$/.test(pathname)
  )
}

/**
 * Accept-Language → locale.
 * HU → hu, DE → de, egyéb → en (spec szerint).
 */
export function getLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return 'en'
  const parts = header.split(',').map((part) => {
    const [tag, ...params] = part.trim().split(';')
    const qParam = params.find((p) => p.trim().startsWith('q='))
    const q = qParam ? Number(qParam.split('=')[1]) : 1
    return { lang: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 }
  })
  parts.sort((a, b) => b.q - a.q)
  for (const { lang } of parts) {
    const primary = lang.split('-')[0]
    if (primary === 'hu') return 'hu'
    if (primary === 'de') return 'de'
  }
  return 'en'
}

export function getPathSegment(key: PathKey, locale: Locale): string {
  return PATH_SEGMENTS[key][locale] ?? PATH_SEGMENTS[key].en
}

/**
 * Belső (magyar) útvonal → nyelvspecifikus URL (locale prefixszel).
 * Pl. /termekek?kategoria=otthon + en → /en/products?kategoria=otthon
 * Pl. /termek/slug + de → /de/produkt/slug
 */
export function localizePath(pathname: string, locale: Locale, search = ''): string {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (shouldSkipLocaleRouting(clean) || clean.startsWith('/admin')) {
    return `${clean}${search}`
  }

  // Már van locale prefix?
  const stripped = stripLocalePrefix(clean)
  const path = stripped.pathname
  const segments = path.split('/').filter(Boolean)

  if (segments.length === 0) {
    return `/${locale}${search}`
  }

  const first = segments[0]
  const key = SEGMENT_TO_KEY[first]
  if (!key) {
    // Ismeretlen path – prefixeljük a locale-lal, szegmenst nem fordítjuk
    return `/${locale}${path}${search}`
  }

  const localizedFirst = getPathSegment(key, locale)
  const rest = segments.slice(1)

  if (key === 'checkout' && rest.length > 0) {
    const subKey = CHECKOUT_SUB_TO_KEY[rest[0]]
    if (subKey) {
      const localizedSub = getPathSegment(subKey, locale)
      const after = rest.slice(1)
      const suffix = after.length ? `/${after.join('/')}` : ''
      return `/${locale}/${localizedFirst}/${localizedSub}${suffix}${search}`
    }
  }

  if (key === 'product' && rest.length > 0) {
    return `/${locale}/${localizedFirst}/${rest.join('/')}${search}`
  }

  const suffix = rest.length ? `/${rest.join('/')}` : ''
  return `/${locale}/${localizedFirst}${suffix}${search}`
}

export function stripLocalePrefix(pathname: string): { locale: Locale | null; pathname: string } {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return { locale: null, pathname: '/' }
  const maybe = segments[0]
  if (isValidLocale(maybe)) {
    const rest = '/' + segments.slice(1).join('/')
    return { locale: maybe, pathname: rest === '/' ? '/' : rest.replace(/\/$/, '') || '/' }
  }
  return { locale: null, pathname }
}

/**
 * Nyelvspecifikus (vagy belső) path → belső magyar fájlrendszeri path.
 * Pl. /products → /termekek, /produkt/foo → /termek/foo
 */
export function toInternalPath(pathname: string): string {
  const { pathname: stripped } = stripLocalePrefix(pathname)
  const path = stripped.startsWith('/') ? stripped : `/${stripped}`
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return '/'

  const first = segments[0]
  const key = SEGMENT_TO_KEY[first]
  if (!key) return path

  const internalFirst = PATH_SEGMENTS[key].hu
  const rest = segments.slice(1)

  if (key === 'checkout' && rest.length > 0) {
    const subKey = CHECKOUT_SUB_TO_KEY[rest[0]]
    if (subKey) {
      const internalSub = PATH_SEGMENTS[subKey].hu
      const after = rest.slice(1)
      const suffix = after.length ? `/${after.join('/')}` : ''
      return `/${internalFirst}/${internalSub}${suffix}`
    }
  }

  const suffix = rest.length ? `/${rest.join('/')}` : ''
  return `/${internalFirst}${suffix}`
}

/** Path key helper a linkekhez. */
export function hrefFor(key: PathKey, locale: Locale, suffix = '', search = ''): string {
  if (key === 'checkoutSuccess') {
    return `/${locale}/${getPathSegment('checkout', locale)}/${getPathSegment('checkoutSuccess', locale)}${suffix}${search}`
  }
  if (key === 'checkoutCancel') {
    return `/${locale}/${getPathSegment('checkout', locale)}/${getPathSegment('checkoutCancel', locale)}${suffix}${search}`
  }
  if (key === 'product') {
    return `/${locale}/${getPathSegment('product', locale)}${suffix}${search}`
  }
  const seg = getPathSegment(key, locale)
  return `/${locale}/${seg}${suffix}${search}`
}

/** Aktuális lokalizált path átírása másik locale-ra (ugyanaz az oldal). */
export function switchLocalePath(currentPathname: string, nextLocale: Locale, search = ''): string {
  const asInternal = toInternalPath(currentPathname)
  return localizePath(asInternal, nextLocale, search)
}

export function buildAlternatesLanguages(
  internalPath: string,
  search = '',
  baseUrl: string
): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const locale of SEO_LOCALES) {
    languages[locale] = `${baseUrl}${localizePath(internalPath, locale, search)}`
  }
  languages['x-default'] = `${baseUrl}${localizePath(internalPath, 'en', search)}`
  return languages
}
