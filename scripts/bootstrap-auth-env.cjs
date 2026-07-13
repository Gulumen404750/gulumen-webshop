/**
 * Node start scriptben futtatva – NextAuth env még a Next.js betöltése előtt.
 * Ugyanaz a logika, mint src/lib/bootstrap-auth-env.ts (CJS).
 */
const { createHash } = require('crypto')

function deriveSecretFromDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return undefined
  return createHash('sha256').update(`gulumen-nextauth:${url}`).digest('base64')
}

function resolveNextAuthSecret() {
  return (
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.ADMIN_API_KEY?.trim() ||
    deriveSecretFromDatabaseUrl()
  )
}

if (!process.env.NEXTAUTH_URL?.trim()) {
  process.env.NEXTAUTH_URL =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
}

const secret = resolveNextAuthSecret()
if (secret && !process.env.NEXTAUTH_SECRET?.trim()) {
  process.env.NEXTAUTH_SECRET = secret
}

if (process.env.NODE_ENV === 'production') {
  if (secret) {
    console.log('[start] NextAuth secret: configured (fallback ok)')
  } else {
    console.warn('[start] NextAuth secret: MISSING – set NEXTAUTH_SECRET or DATABASE_URL on Railway')
  }
}
