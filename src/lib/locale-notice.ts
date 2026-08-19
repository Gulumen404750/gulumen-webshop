/**
 * Locale-reactive UI notice: store the i18n key, translate at render
 * so language changes update the text without resubmitting the form.
 */
export type LocaleNotice = {
  key: string
  params?: Record<string, string | number>
  /** Optional untranslated server detail (shown in parentheses). */
  detail?: string
}

export function localeNoticeText(
  t: (key: string, params?: Record<string, string | number>) => string,
  notice: LocaleNotice | null | undefined
): string | null {
  if (!notice?.key) return null
  const text = t(notice.key, notice.params)
  return notice.detail ? `${text} (${notice.detail})` : text
}
