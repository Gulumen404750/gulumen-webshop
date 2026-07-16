'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  type Locale,
  DEFAULT_LOCALE,
  STORAGE_KEY,
  isValidLocale,
  LOCALES,
} from '@/i18n/locales'
import { getTranslations, t as translate } from '@/i18n/translations'
import {
  LOCALE_COOKIE,
  stripLocalePrefix,
  switchLocalePath,
} from '@/i18n/routing'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  const value = match?.[1]
  return value && isValidLocale(value) ? value : null
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const pathLocale = useMemo(() => {
    const { locale } = stripLocalePrefix(pathname || '/')
    return locale
  }, [pathname])

  const [locale, setLocaleState] = useState<Locale>(
    pathLocale || initialLocale || DEFAULT_LOCALE
  )
  const [mounted, setMounted] = useState(false)

  // URL locale az igazság forrása
  useEffect(() => {
    if (pathLocale && pathLocale !== locale) {
      setLocaleState(pathLocale)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, pathLocale)
        document.documentElement.lang = pathLocale
      }
    }
  }, [pathLocale, locale])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMounted(true)
    if (pathLocale) {
      setLocaleState(pathLocale)
      localStorage.setItem(STORAGE_KEY, pathLocale)
      document.documentElement.lang = pathLocale
      return
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    const cookieLocale = readCookieLocale()
    const next =
      (stored && isValidLocale(stored) && stored) ||
      cookieLocale ||
      initialLocale ||
      DEFAULT_LOCALE
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next
  }, [pathLocale, initialLocale])

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next)
        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
        document.documentElement.lang = next
      }
      const search = searchParams?.toString()
      const searchStr = search ? `?${search}` : ''
      const target = switchLocalePath(pathname || '/', next, searchStr)
      router.push(target)
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    if (mounted && typeof document !== 'undefined') document.documentElement.lang = locale
  }, [mounted, locale])

  const dict = useMemo(() => getTranslations(locale), [locale])
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(dict, key, params),
    [dict]
  )

  const value: LocaleContextValue = {
    locale: mounted ? locale : pathLocale || initialLocale || DEFAULT_LOCALE,
    setLocale,
    t,
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}

export { LOCALES }
