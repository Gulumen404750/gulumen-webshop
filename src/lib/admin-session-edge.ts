/**
 * Edge-safe admin session verify (middleware).
 * Nincs Node-only dependency; csak jose jwtVerify.
 */

import { jwtVerify } from 'jose'

export const ADMIN_COOKIE_NAME = 'admin_authorized'
const JWT_ISSUER = 'gulumen-admin'
const JWT_AUDIENCE = 'gulumen-admin'

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 16) return null
  return new TextEncoder().encode(secret)
}

/** True ha a cookie érték érvényes, aláírt admin JWT. */
export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || token === '1') return false
  const secret = getSecret()
  if (!secret) return false
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    return payload.sub === 'admin'
  } catch {
    return false
  }
}
