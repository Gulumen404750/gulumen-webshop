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

export const DEFAULT_LOCALE: Locale = 'hu'
export const STORAGE_KEY = 'gulumen-locale'

export function isValidLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
