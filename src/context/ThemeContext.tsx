'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyThemeClass,
  readStoredThemePreference,
  resolveIsDark,
  saveThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme'

type ThemeContextValue = {
  preference: ThemePreference
  dark: boolean
  hasChosen: boolean
  ready: boolean
  setPreference: (preference: ThemePreference) => void
  toggleLightDark: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [dark, setDark] = useState(false)
  const [hasChosen, setHasChosen] = useState(false)
  const [ready, setReady] = useState(false)

  const apply = useCallback((next: ThemePreference, persist: boolean) => {
    const isDark = resolveIsDark(next)
    applyThemeClass(isDark)
    setPreferenceState(next)
    setDark(isDark)
    if (persist) {
      saveThemePreference(next)
      setHasChosen(true)
    }
  }, [])

  useEffect(() => {
    const stored = readStoredThemePreference()
    if (stored) {
      apply(stored, false)
      setHasChosen(true)
      try {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          saveThemePreference(stored)
        }
      } catch {
        /* private mode */
      }
    } else {
      apply('system', false)
      setHasChosen(false)
    }
    setReady(true)
  }, [apply])

  useEffect(() => {
    if (!ready || preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const isDark = media.matches
      applyThemeClass(isDark)
      setDark(isDark)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference, ready])

  const setPreference = useCallback(
    (next: ThemePreference) => {
      apply(next, true)
    },
    [apply]
  )

  const toggleLightDark = useCallback(() => {
    setPreference(dark ? 'light' : 'dark')
  }, [dark, setPreference])

  const value = useMemo(
    () => ({
      preference,
      dark,
      hasChosen,
      ready,
      setPreference,
      toggleLightDark,
    }),
    [preference, dark, hasChosen, ready, setPreference, toggleLightDark]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
