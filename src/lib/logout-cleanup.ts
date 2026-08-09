import { clearPersistedCart } from '@/lib/cart-storage'
import {
  clearPendingPointsRedeem,
  clearPointWalletCache,
} from '@/lib/point-wallet-client'

type LogoutListener = () => void

const listeners = new Set<LogoutListener>()

/** CartContext és más providerek regisztrálhatnak azonnali state resetet. */
export function onLogoutCleanup(listener: LogoutListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Kijelentkezéskor: gulumen_* / gulumen-* / gulumen:* localStorage + teljes sessionStorage.
 * Megosztott böngészőn ne maradjon kedvenc / pending pont / consent a következő usernél.
 */
export function clearGulumenClientStorage() {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.clear()
  } catch {
    /* private mode */
  }

  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (
        key.startsWith('gulumen_') ||
        key.startsWith('gulumen-') ||
        key.startsWith('gulumen:')
      ) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch {
    /* private mode */
  }

  // In-memory optimista pontlevonás flag (sessionStorage már törölve)
  clearPendingPointsRedeem()
  void clearPointWalletCache()
}

/** Kijelentkezéskor: storage törlés + regisztrált React state resetek. */
export function runLogoutCleanup() {
  clearGulumenClientStorage()
  clearPersistedCart()
  for (const listener of listeners) {
    try {
      listener()
    } catch (e) {
      console.error('[logout-cleanup] listener failed', e)
    }
  }
}
