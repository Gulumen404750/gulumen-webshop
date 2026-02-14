'use client'

import { useEffect } from 'react'

/**
 * MetaMask / wallet extension hibák ne borítsák a webshopot.
 * Unhandled Runtime Error helyett csak console.warn.
 */
export function WalletErrorGuard() {
  useEffect(() => {
    const isWalletError = (msg: string | unknown): boolean => {
      const s = typeof msg === 'string' ? msg : String(msg ?? '')
      return (
        /metamask/i.test(s) ||
        /ethereum/i.test(s) ||
        /failed to connect/i.test(s) ||
        /wallet/i.test(s)
      )
    }

    const onError = (event: ErrorEvent) => {
      if (isWalletError(event.message) || isWalletError(event.error?.message)) {
        console.warn('[WalletErrorGuard] Suppressed error:', event.message, event.error)
        event.preventDefault()
        return true
      }
      return false
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message ?? event.reason
      if (isWalletError(reason)) {
        console.warn('[WalletErrorGuard] Suppressed unhandled rejection:', reason)
        event.preventDefault()
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
