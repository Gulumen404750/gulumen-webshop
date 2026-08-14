'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { useTheme } from '@/context/ThemeContext'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { ThemePreference } from '@/lib/theme'

const APPEAR_DELAY_MS = 420

/**
 * Első látogatáskor kérdezi meg a világos / sötét / automatikus nézetet.
 * Ha már van mentett választás (gulumen-theme vagy a régi gulumen-dark), nem jelenik meg.
 */
export function ThemeChooser() {
  const pathname = usePathname()
  const { t } = useLocale()
  const { hasChosen, ready, setPreference } = useTheme()
  const [visible, setVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const suppress = pathname?.startsWith('/admin')

  useEffect(() => {
    if (!ready || hasChosen || suppress) {
      setVisible(false)
      return
    }
    const timer = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [ready, hasChosen, suppress])

  useFocusTrap(panelRef, visible)

  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  if (!visible) return null

  const options: {
    value: ThemePreference
    icon: typeof Sun
    titleKey: string
    hintKey: string
  }[] = [
    { value: 'light', icon: Sun, titleKey: 'themeChooser.light', hintKey: 'themeChooser.lightHint' },
    { value: 'dark', icon: Moon, titleKey: 'themeChooser.dark', hintKey: 'themeChooser.darkHint' },
    { value: 'system', icon: Monitor, titleKey: 'themeChooser.system', hintKey: 'themeChooser.systemHint' },
  ]

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-chooser-title"
      aria-describedby="theme-chooser-desc"
    >
      <div className="absolute inset-0 bg-black/50 theme-chooser-backdrop" aria-hidden />
      <div
        ref={panelRef}
        className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl p-6 sm:p-7 theme-chooser-panel"
      >
        <p className="text-center text-2xl mb-3" aria-hidden>
          👋
        </p>
        <h2
          id="theme-chooser-title"
          className="font-heading text-xl font-bold text-foreground text-center mb-2"
        >
          {t('themeChooser.title')}
        </h2>
        <p id="theme-chooser-desc" className="text-sm text-muted text-center mb-6">
          {t('themeChooser.subtitle')}
        </p>
        <div className="grid gap-3">
          {options.map(({ value, icon: Icon, titleKey, hintKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreference(value)}
              className="flex items-start gap-3 w-full rounded-xl border border-[var(--border)] bg-background px-4 py-3 text-left hover:border-accent hover:bg-accent/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card-bg)] transition-colors"
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Icon className="w-5 h-5" aria-hidden />
              </span>
              <span>
                <span className="block font-heading font-semibold text-foreground">
                  {t(titleKey)}
                </span>
                <span className="block text-sm text-muted mt-0.5">{t(hintKey)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
