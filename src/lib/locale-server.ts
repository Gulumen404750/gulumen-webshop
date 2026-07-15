import 'server-only'

import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, STORAGE_KEY, isValidLocale, type Locale } from '@/i18n/locales'

export async function getServerLocale(): Promise<Locale> {
  const headersList = await headers()
  const search = headersList.get('x-search') ?? ''
  const langParam = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('lang')
  if (langParam && isValidLocale(langParam)) return langParam

  const cookieStore = await cookies()
  const value = cookieStore.get(STORAGE_KEY)?.value
  if (value && isValidLocale(value)) return value
  return DEFAULT_LOCALE
}
