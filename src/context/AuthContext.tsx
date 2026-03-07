'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type AuthContextValue = {
  userId: string | null
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>
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
        if (data?.user?.email) setUserId(data.user.email)
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
      setUserId(data.user.email)
      return { ok: true }
    }
    return { ok: false, error: data.error || 'Bejelentkezés sikertelen' }
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email.trim(), password, name: name?.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.user?.email) {
      setUserId(data.user.email)
      return { ok: true }
    }
    return { ok: false, error: data.error || 'Regisztráció sikertelen' }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUserId(null)
  }, [])

  const value: AuthContextValue = {
    userId: mounted ? userId : null,
    isLoggedIn: !!userId,
    login,
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
