/**
 * Session verzió + API-kulcs claim.
 * - sv: JWT_SECRET + ADMIN_API_KEY hash (bármelyik csere érvényteleníti a sütit)
 * - ak: csak ADMIN_API_KEY hash – a JWT HMAC JWT_SECRET-tel van aláírva, ezért a kulcscsere
 *   önmagában nem bontaná az aláírást; ezt a claimet külön ellenőrizzük.
 * Edge-kompatibilis (Web Crypto).
 */

import {
  ADMIN_SESSION_API_KEY_CLAIM,
  ADMIN_SESSION_VERSION_CLAIM,
} from '@/lib/admin-session-constants'

export { ADMIN_SESSION_API_KEY_CLAIM, ADMIN_SESSION_VERSION_CLAIM }

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256HexPrefix(payload: string, bytes = 8): Promise<string> {
  const data = new TextEncoder().encode(payload)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(hash).slice(0, bytes))
}

export async function getAdminSessionVersion(env: {
  JWT_SECRET?: string
  NEXTAUTH_SECRET?: string
  ADMIN_API_KEY?: string
} = process.env): Promise<string> {
  const jwt = env.JWT_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim() || ''
  const apiKey = env.ADMIN_API_KEY?.trim() || ''
  return sha256HexPrefix(`gulumen-admin-sv|${jwt}|${apiKey}`)
}

export async function getAdminApiKeyClaim(
  env: { ADMIN_API_KEY?: string } = process.env as { ADMIN_API_KEY?: string }
): Promise<string> {
  const apiKey = env.ADMIN_API_KEY?.trim() || ''
  return sha256HexPrefix(`gulumen-admin-ak|${apiKey}`)
}
