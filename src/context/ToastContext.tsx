'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

type ToastContextValue = {
  toast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 3000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
  }, [])

  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => setMessage(null), TOAST_DURATION_MS)
    return () => clearTimeout(id)
  }, [message])

  return (
    <ToastContext.Provider value={{ toast: showToast }}>
      {children}
      {message && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-lg bg-foreground text-background text-sm font-medium shadow-lg"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
