/**
 * Node start scriptben futtatva – NextAuth env még a Next.js betöltése előtt.
 */
const { createHash } = require('crypto')

const PRODUCTION_FALLBACK_SECRET = createHash('sha256')
  .update('gulumen-webshop-production-nextauth-v2')
  .digest('base64')

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
    deriveSecretFromDatabaseUrl() ||
    (process.env.NODE_ENV === 'production'
      ? PRODUCTION_FALLBACK_SECRET
      : 'dev-insecure-nextauth-secret-local-only')
  )
}

if (!process.env.NEXTAUTH_URL?.trim()) {
  process.env.NEXTAUTH_URL =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
}

const secret = resolveNextAuthSecret()
if (!process.env.NEXTAUTH_SECRET?.trim()) {
  process.env.NEXTAUTH_SECRET = secret
}

if (process.env.NODE_ENV === 'production') {
  const source = process.env.NEXTAUTH_SECRET === secret ? 'fallback' : 'env'
  console.log(`[start] NextAuth secret: ok (${source})`)
  console.log(`[start] NextAuth URL: ${process.env.NEXTAUTH_URL}`)
  if (!process.env.DATABASE_URL?.trim()) {
    console.warn('[start] DATABASE_URL missing – link Postgres to gulumen-webshop in Railway Variables')
  }
}
