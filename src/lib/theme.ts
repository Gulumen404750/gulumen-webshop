export const THEME_STORAGE_KEY = 'gulumen-theme'
export const THEME_LEGACY_KEY = 'gulumen-dark'

export type ThemePreference = 'light' | 'dark' | 'system'

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function resolveIsDark(preference: ThemePreference): boolean {
  if (preference === 'dark') return true
  if (preference === 'light') return false
  return prefersDarkScheme()
}

export function applyThemeClass(isDark: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', isDark)
}

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

/** Mentett választás, vagy a régi gulumen-dark kulcs. Nincs mentés → null. */
export function readStoredThemePreference(): ThemePreference | null {
  const stored = readStorage(THEME_STORAGE_KEY)
  if (isThemePreference(stored)) return stored
  const legacy = readStorage(THEME_LEGACY_KEY)
  if (legacy === 'true') return 'dark'
  if (legacy === 'false') return 'light'
  return null
}

export function hasChosenTheme(): boolean {
  return readStoredThemePreference() !== null
}

export function saveThemePreference(preference: ThemePreference): void {
  writeStorage(THEME_STORAGE_KEY, preference)
  if (preference === 'system') {
    writeStorage(THEME_LEGACY_KEY, resolveIsDark(preference) ? 'true' : 'false')
  } else {
    writeStorage(THEME_LEGACY_KEY, preference === 'dark' ? 'true' : 'false')
  }
  applyThemeClass(resolveIsDark(preference))
}

/** Kijelentkezéskor a téma marad – ez eszközbeállítás, nem fiókadat. */
export function isThemeStorageKey(key: string): boolean {
  return key === THEME_STORAGE_KEY || key === THEME_LEGACY_KEY
}

/**
 * Inline script a layout <head>-jébe: sötét osztály a React hidratálás előtt,
 * hogy ne villanjon a világos háttér. Nem ír localStorage-t.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var l=localStorage.getItem('${THEME_LEGACY_KEY}');var dark=false;if(t==='dark')dark=true;else if(t==='light')dark=false;else if(t==='system'||(!t&&!l))dark=window.matchMedia('(prefers-color-scheme: dark)').matches;else dark=l==='true';document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`
