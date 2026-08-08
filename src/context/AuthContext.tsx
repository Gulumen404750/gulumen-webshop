'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { saveGoogleAuthPending } from '@/lib/google-auth-pending'
import { runLogoutCleanup } from '@/lib/logout-cleanup'
import { getCanonicalAppOrigin } from '@/lib/app-url'

export type GoogleAuthOptions = {
  /** Regisztrációs flow: true = 10%-os kupon, false = csak bejelentkezés */
  acceptOffers?: boolean
  callbackUrl?: string
}

type AuthContextValue = {
  userId: string | null
  isLoggedIn: boolean
  /** Session ellenőrzés kész (ne töröljünk wishlistet hydration közben). */
  authChecked: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  loginWithGoogle: (options?: GoogleAuthOptions) => void
  register: (
    email: string,
    password: string,
    name?: string,
    acceptOffers?: boolean
  ) => Promise<{ ok: boolean; error?: string; email?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMounted(true)
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.email) setUserId(data.user.email.trim().toLowerCase())
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
      const email = data.user.email.trim().toLowerCase()
      setUserId(email)
      return { ok: true }
    }
    return { ok: false, error: data.error || 'Bejelentkezés sikertelen' }
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string, acceptOffers?: boolean) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        name: name?.trim() || undefined,
        acceptOffers: acceptOffers === true,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.user?.email) {
      const normalized = data.user.email.trim().toLowerCase()
      setUserId(normalized)
      return { ok: true, email: normalized }
    }
    if (res.status === 409) {
      return {
        ok: false,
        error:
          typeof data.error === 'string' && data.error
            ? data.error
            : 'Ezzel az e-mail címmel már regisztráltak. Jelentkezz be.',
      }
    }
    return { ok: false, error: data.error || 'Regisztráció sikertelen' }
  }, [])

  const loginWithGoogle = useCallback(async (options?: GoogleAuthOptions) => {
    const base = getCanonicalAppOrigin()
    const callback = options?.callbackUrl ?? `${base}/profil`
    if (options?.acceptOffers === true) {
      saveGoogleAuthPending(true)
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
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    const base = getCanonicalAppOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
    window.location.href = `${base}/api/auth/signout?callbackUrl=${encodeURIComponent(base + '/')}`
  }, [])

  const value: AuthContextValue = {
    userId: mounted ? userId : null,
    isLoggedIn: !!userId,
    authChecked: mounted && authChecked,
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
