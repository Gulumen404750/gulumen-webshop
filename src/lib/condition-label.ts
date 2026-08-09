import type { Locale } from '@/i18n/locales'
import { getTranslations, t } from '@/i18n/translations'

/** Product condition values stored in HU in the DB; display via i18n. */
export function getConditionLabel(condition: string, locale: Locale): string {
  const dict = getTranslations(locale)
  const translated = t(dict, `condition.${condition}`)
  // t() returns the key path when missing — fall back to raw condition string.
  if (translated === `condition.${condition}`) return condition
  return translated
}
