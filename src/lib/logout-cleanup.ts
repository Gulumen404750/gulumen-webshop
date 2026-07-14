import { clearPersistedCart } from '@/lib/cart-storage'

type LogoutListener = () => void

const listeners = new Set<LogoutListener>()

/** CartContext és más providerek regisztrálhatnak azonnali state resetet. */
export function onLogoutCleanup(listener: LogoutListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Kijelentkezéskor: storage törlés + regisztrált React state resetek. */
export function runLogoutCleanup() {
  clearPersistedCart()
  for (const listener of listeners) {
    try {
      listener()
    } catch (e) {
      console.error('[logout-cleanup] listener failed', e)
    }
  }
}
