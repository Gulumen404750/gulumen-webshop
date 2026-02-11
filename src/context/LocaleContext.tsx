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
import {
  type Locale,
  DEFAULT_LOCALE,
  STORAGE_KEY,
  isValidLocale,
  LOCALES,
} from '@/i18n/locales'
import { getTranslations, t as translate } from '@/i18n/translations'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isValidLocale(stored)) setLocaleState(stored as Locale)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next)
      document.documentElement.lang = next
    }
  }, [])

  useEffect(() => {
    if (mounted && typeof document !== 'undefined') document.documentElement.lang = locale
  }, [mounted, locale])

  const dict = useMemo(() => getTranslations(locale), [locale])
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(dict, key, params),
    [dict]
  )

  const value: LocaleContextValue = {
    locale: mounted ? locale : DEFAULT_LOCALE,
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
