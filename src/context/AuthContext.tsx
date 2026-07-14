'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type AuthContextValue = {
  userId: string | null
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  loginWithGoogle: () => void
  register: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string; email?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMounted(true)
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.email) setUserId(data.user.email.trim().toLowerCase())
      })
      .catch(() => {})
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

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name?.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.user?.email) {
      const normalized = data.user.email.trim().toLowerCase()
      setUserId(normalized)
      return { ok: true, email: normalized }
    }
    return { ok: false, error: data.error || 'Regisztráció sikertelen' }
  }, [])

  const loginWithGoogle = useCallback(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    window.location.href = `${base}/api/auth/signin/google?callbackUrl=${encodeURIComponent(base + '/profil')}`
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUserId(null)
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    window.location.href = `${base}/api/auth/signout?callbackUrl=${encodeURIComponent(base + '/')}`
  }, [])

  const value: AuthContextValue = {
    userId: mounted ? userId : null,
    isLoggedIn: !!userId,
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
