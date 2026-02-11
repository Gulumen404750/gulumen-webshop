/** Csak 4 nyelv elérhető. */
export const LOCALES = ['hu', 'en', 'de', 'ro'] as const

export type Locale = (typeof LOCALES)[number]

/** Lenyílóban megjelenő nevek: Magyar, Angol, Német, Román */
export const LOCALE_LABELS: Record<Locale, string> = {
  hu: 'Magyar',
  en: 'Angol',
  de: 'Német',
  ro: 'Román',
}

/** Ha nem tudjuk megállapítani a régiót, angol lesz az alapértelmezett. */
export const FALLBACK_LOCALE: Locale = 'en'

/** Korábbi viselkedés: magyar alapértelmezett (pl. szerver oldali első render). */
export const DEFAULT_LOCALE: Locale = 'hu'

export const STORAGE_KEY = 'gulumen-locale'

export function isValidLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * Böngésző nyelve / régió alapján visszaadja a megfelelő locale-ot.
 * Csak böngészőben hívandó (navigator.languages). Ismeretlen régió → angol.
 */
export function getLocaleFromBrowser(): Locale {
  if (typeof navigator === 'undefined' || !navigator.languages?.length) return FALLBACK_LOCALE
  const preferred = navigator.languages.map((l) => l.split('-')[0].toLowerCase())
  for (const lang of preferred) {
    if (lang === 'hu') return 'hu'
    if (lang === 'de') return 'de'
    if (lang === 'ro') return 'ro'
  }
  return FALLBACK_LOCALE
}
