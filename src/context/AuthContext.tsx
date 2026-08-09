'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { clearGoogleAuthPending, saveGoogleAuthPending } from '@/lib/google-auth-pending'
import { markRegistrationConsent } from '@/lib/registration-consent'
import { runLogoutCleanup } from '@/lib/logout-cleanup'
import { getCanonicalAppOrigin } from '@/lib/app-url'

export type GoogleAuthOptions = {
  /** Új regisztráció: ÁSZF / adatkezelés elfogadva a Google indítás előtt */
  acceptPrivacy?: boolean
  /** Új regisztráció: opcionális 10% kupon + ajánlat e-mailek */
  acceptOffers?: boolean
  callbackUrl?: string
}

type AuthContextValue = {
  userId: string | null
  isLoggedIn: boolean
  /** Session ellenőrzés kész (ne töröljünk wishlistet hydration közben). */
  authChecked: boolean
  /** Google első belépés ebben a sessionben (új fiók). Meglévő usernél mindig false. */
  isNewUser: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  loginWithGoogle: (options?: GoogleAuthOptions) => void
  register: (
    email: string,
    password: string,
    name?: string,
    acceptOffers?: boolean,
    birthDate?: string | null
  ) => Promise<{ ok: boolean; error?: string; email?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMounted(true)
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.email) {
          setUserId(data.user.email.trim().toLowerCase())
          setIsNewUser(data.isNewUser === true)
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email.trim(), password }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.user?.email) {
      const normalized = data.user.email.trim().toLowerCase()
      setUserId(normalized)
      setIsNewUser(false)
      return { ok: true }
    }
    return { ok: false, error: data.error || 'Login failed' }
  }, [])

  const register = useCallback(async (
    email: string,
    password: string,
    name?: string,
    acceptOffers?: boolean,
    birthDate?: string | null
  ) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        name: name?.trim() || undefined,
        acceptOffers: acceptOffers === true,
        ...(birthDate ? { birthDate } : {}),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.user?.email) {
      const normalized = data.user.email.trim().toLowerCase()
      setUserId(normalized)
      setIsNewUser(false)
      markRegistrationConsent(normalized, acceptOffers === true)
      return { ok: true, email: normalized }
    }
    if (res.status === 409) {
      return {
        ok: false,
        error:
          typeof data.error === 'string' && data.error
            ? data.error
            : 'An account with this email already exists. Please log in.',
      }
    }
    return { ok: false, error: data.error || 'Registration failed' }
  }, [])

  const loginWithGoogle = useCallback(async (options?: GoogleAuthOptions) => {
    const base = getCanonicalAppOrigin()
    const callback = options?.callbackUrl ?? `${base}/profil`

    // Meglévő fiók belépés: ne vigyünk át régi kupon-pendinget.
    // Új regisztráció: mentsük a hozzájárulásokat OAuth előtt.
    if (options?.acceptPrivacy === true || options?.acceptOffers === true) {
      saveGoogleAuthPending({
        acceptPrivacy: options.acceptPrivacy === true,
        acceptOffers: options.acceptOffers === true,
      })
    } else {
      clearGoogleAuthPending()
    }

    try {
      const csrfRes = await fetch(`${base}/api/auth/csrf`, { credentials: 'include' })
      if (!csrfRes.ok) throw new Error(`CSRF ${csrfRes.status}`)
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = `${base}/api/auth/signin/google`
      form.style.display = 'none'
      const csrfInput = document.createElement('input')
      csrfInput.type = 'hidden'
      csrfInput.name = 'csrfToken'
      csrfInput.value = csrfToken
      form.appendChild(csrfInput)
      const cbInput = document.createElement('input')
      cbInput.type = 'hidden'
      cbInput.name = 'callbackUrl'
      cbInput.value = callback
      form.appendChild(cbInput)
      document.body.appendChild(form)
      form.submit()
    } catch {
      window.location.href = `${base}/profil?authError=google`
    }
  }, [])

  const logout = useCallback(async () => {
    runLogoutCleanup()
    setUserId(null)
    setIsNewUser(false)
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    const base = getCanonicalAppOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
    window.location.href = `${base}/api/auth/signout?callbackUrl=${encodeURIComponent(base + '/')}`
  }, [])

  const value: AuthContextValue = {
    userId: mounted ? userId : null,
    isLoggedIn: !!userId,
    authChecked: mounted && authChecked,
    isNewUser: mounted ? isNewUser : false,
    login,
    loginWithGoogle,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
