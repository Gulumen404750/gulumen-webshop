'use client'

import Link from 'next/link'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type ToastAction = { label: string; href: string }

type ToastOptions = { action?: ToastAction }

type ToastContextValue = {
  toast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 4000

type ToastState = { message: string; action?: ToastAction } | null

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<ToastState>(null)

  const showToast = useCallback((msg: string, options?: ToastOptions) => {
    setToastState({ message: msg, action: options?.action })
  }, [])

  useEffect(() => {
    if (!toastState) return
    const id = setTimeout(() => setToastState(null), TOAST_DURATION_MS)
    return () => clearTimeout(id)
  }, [toastState])

  return (
    <ToastContext.Provider value={{ toast: showToast }}>
      {children}
      {toastState && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col sm:flex-row items-center gap-2 px-4 py-3 rounded-lg bg-foreground text-background text-sm font-medium shadow-lg"
        >
          <span>{toastState.message}</span>
          {toastState.action && (
            <Link
              href={toastState.action.href}
              className="underline font-semibold hover:opacity-90 whitespace-nowrap"
            >
              {toastState.action.label}
            </Link>
          )}
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
