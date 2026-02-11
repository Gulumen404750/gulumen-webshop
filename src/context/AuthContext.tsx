'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

const STORAGE_KEY = 'gulumen-user-id'

type AuthContextValue = {
  userId: string | null
  isLoggedIn: boolean
  login: (userId: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setUserId(stored)
  }, [])

  const login = useCallback((id: string) => {
    setUserId(id)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const logout = useCallback(() => {
    setUserId(null)
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value: AuthContextValue = {
    userId: mounted ? userId : null,
    isLoggedIn: !!userId,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
