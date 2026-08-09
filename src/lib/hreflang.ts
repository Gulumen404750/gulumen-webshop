import { FALLBACK_LOCALE, LOCALES, type Locale } from '@/i18n/locales'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu').replace(/\/$/, '')

export type HreflangAlternate = {
  hreflang: string
  href: string
}

/**
 * Ugyanaz az útvonal, locale query parammal – összhangban a LocaleContext ?lang= kezelésével.
 */
export function buildLocalizedUrl(pathname: string, search: string, locale: Locale): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.set('lang', locale)
  const qs = params.toString()
  return `${BASE_URL}${path}?${qs}`
}

export function getHreflangAlternates(pathname: string, search = ''): HreflangAlternate[] {
  const normalizedPath = pathname || '/'
  const alternates: HreflangAlternate[] = LOCALES.map((locale) => ({
    hreflang: locale,
    href: buildLocalizedUrl(normalizedPath, search, locale),
  }))
  alternates.push({
    hreflang: 'x-default',
    href: buildLocalizedUrl(normalizedPath, search, FALLBACK_LOCALE),
  })
  return alternates
}
