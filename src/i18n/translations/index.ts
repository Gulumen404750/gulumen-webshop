import type { Locale } from '../locales'
import hu from './hu.json'
import en from './en.json'
import de from './de.json'
import ro from './ro.json'

export type TranslationDict = typeof hu

const translations: Record<Locale, TranslationDict> = {
  hu,
  en,
  de,
  ro,
}

export function getTranslations(locale: Locale): TranslationDict {
  return translations[locale] ?? en
}

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[p]
  }
  return typeof current === 'string' ? current : undefined
}

export function t(dict: TranslationDict, key: string, params?: Record<string, string | number>): string {
  let value = getNested(dict as Record<string, unknown>, key)
  if (value === undefined && dict !== en) value = getNested(en as Record<string, unknown>, key)
  if (value === undefined) return key
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value!.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    })
  }
  return value
}
