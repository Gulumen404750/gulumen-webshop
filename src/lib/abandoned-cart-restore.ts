import { createHash, randomBytes } from 'crypto'
import type { CartItem } from '@/lib/cart-storage'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu').replace(/\/$/, '')

export const ABANDONED_CART_RESTORE_PATH = '/kosar/visszaallitas'

export function hashRestoreToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateRestoreToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashRestoreToken(token) }
}

export function abandonedCartRestoreUrl(token: string, appUrl = APP_URL): string {
  const base = appUrl.replace(/\/$/, '')
  return `${base}${ABANDONED_CART_RESTORE_PATH}?token=${encodeURIComponent(token)}`
}

export function isLikelyRestoreToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,64}$/.test(token)
}

export type FrozenCartPayload = {
  items: CartItem[]
  couponCode?: string | null
}
