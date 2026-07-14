'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { HEARTBEAT_CLIENT_INTERVAL_MS } from '@/lib/gamification/constants'

/**
 * Bejelentkezett user aktív böngészésének percenkénti tick-je.
 * Csak visible + focused tab esetén küld heartbeat-et.
 */
export function BrowseHeartbeatTracker() {
  const { isLoggedIn } = useAuth()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isLoggedIn || typeof document === 'undefined') return

    const sendTick = () => {
      const isVisible = document.visibilityState === 'visible'
      const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : isVisible
      if (!isVisible || !hasFocus) return

      void fetch('/api/gamification/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isVisible, hasFocus }),
      }).catch(() => {})
    }

    const startInterval = () => {
      if (intervalRef.current) return
      intervalRef.current = setInterval(sendTick, HEARTBEAT_CLIENT_INTERVAL_MS)
    }

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && document.hasFocus?.()) {
        sendTick()
        startInterval()
      } else {
        stopInterval()
      }
    }

    if (document.visibilityState === 'visible' && document.hasFocus?.()) {
      sendTick()
      startInterval()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    window.addEventListener('blur', stopInterval)

    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      window.removeEventListener('blur', stopInterval)
    }
  }, [isLoggedIn])

  return null
}
