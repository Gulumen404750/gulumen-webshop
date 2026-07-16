import { cookies, headers } from 'next/headers'
import type { Locale } from '@/i18n/locales'
import { DEFAULT_LOCALE, isValidLocale } from '@/i18n/locales'
import { LOCALE_COOKIE, LOCALE_HEADER } from '@/i18n/routing'

/** Szerver oldali locale: middleware header → cookie → hu. */
export async function getRequestLocale(): Promise<Locale> {
  const h = await headers()
  const fromHeader = h.get(LOCALE_HEADER)
  if (fromHeader && isValidLocale(fromHeader)) return fromHeader

  const jar = await cookies()
  const fromCookie = jar.get(LOCALE_COOKIE)?.value
  if (fromCookie && isValidLocale(fromCookie)) return fromCookie

  return DEFAULT_LOCALE
}
