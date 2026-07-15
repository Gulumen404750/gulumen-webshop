import { STORAGE_KEY, type Locale } from '@/i18n/locales'

export const LOCALE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365

/** Kliens: ugyanaz a kulcs, mint a LocaleContext localStorage-jében. */
export function persistLocaleToCookie(locale: Locale): void {
  if (typeof document === 'undefined') return
  document.cookie = `${STORAGE_KEY}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SEC}; SameSite=Lax`
}
