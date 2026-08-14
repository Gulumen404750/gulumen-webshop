import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyThemeClass,
  hasChosenTheme,
  isThemePreference,
  isThemeStorageKey,
  readStoredThemePreference,
  resolveIsDark,
  saveThemePreference,
  THEME_LEGACY_KEY,
  THEME_STORAGE_KEY,
} from './theme'

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
  })
  return store
}

function stubDocument() {
  const classes = new Set<string>()
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: (name: string, force?: boolean) => {
          if (force === undefined) {
            if (classes.has(name)) classes.delete(name)
            else classes.add(name)
            return
          }
          if (force) classes.add(name)
          else classes.delete(name)
        },
        contains: (name: string) => classes.has(name),
        add: (name: string) => {
          classes.add(name)
        },
        remove: (name: string) => {
          classes.delete(name)
        },
      },
    },
  })
}

describe('theme preference', () => {
  beforeEach(() => {
    stubDocument()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts light, dark, and system', () => {
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('auto')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })

  it('treats missing storage as no choice', () => {
    stubStorage()
    expect(readStoredThemePreference()).toBeNull()
    expect(hasChosenTheme()).toBe(false)
  })

  it('reads the new gulumen-theme key', () => {
    stubStorage({ [THEME_STORAGE_KEY]: 'dark' })
    expect(readStoredThemePreference()).toBe('dark')
    expect(hasChosenTheme()).toBe(true)
  })

  it('migrates the legacy gulumen-dark key', () => {
    stubStorage({ [THEME_LEGACY_KEY]: 'true' })
    expect(readStoredThemePreference()).toBe('dark')
    stubStorage({ [THEME_LEGACY_KEY]: 'false' })
    expect(readStoredThemePreference()).toBe('light')
  })

  it('saves preference and toggles the html dark class', () => {
    stubStorage()
    saveThemePreference('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(localStorage.getItem(THEME_LEGACY_KEY)).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    saveThemePreference('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(localStorage.getItem(THEME_LEGACY_KEY)).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('resolves system preference from matchMedia', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        matches: query.includes('prefers-color-scheme: dark'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })
    expect(resolveIsDark('system')).toBe(true)
    expect(resolveIsDark('light')).toBe(false)
    expect(resolveIsDark('dark')).toBe(true)
  })

  it('identifies theme keys so logout can keep them', () => {
    expect(isThemeStorageKey(THEME_STORAGE_KEY)).toBe(true)
    expect(isThemeStorageKey(THEME_LEGACY_KEY)).toBe(true)
    expect(isThemeStorageKey('gulumen-cart')).toBe(false)
  })

  it('applyThemeClass adds and removes dark on <html>', () => {
    applyThemeClass(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    applyThemeClass(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
