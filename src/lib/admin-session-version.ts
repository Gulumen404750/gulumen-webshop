/**
 * Session verzió: JWT_SECRET + ADMIN_API_KEY hash.
 * Ha bármelyik megváltozik, a korábbi 24 órás JWT sütik érvénytelenek.
 * Edge-kompatibilis (Web Crypto).
 */

import { ADMIN_SESSION_VERSION_CLAIM } from '@/lib/admin-session-constants'

export { ADMIN_SESSION_VERSION_CLAIM }

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function getAdminSessionVersion(env: {
  JWT_SECRET?: string
  NEXTAUTH_SECRET?: string
  ADMIN_API_KEY?: string
} = process.env): Promise<string> {
  const jwt = env.JWT_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim() || ''
  const apiKey = env.ADMIN_API_KEY?.trim() || ''
  const data = new TextEncoder().encode(`gulumen-admin-sv|${jwt}|${apiKey}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(hash).slice(0, 8))
}
