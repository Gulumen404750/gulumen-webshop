/**
 * Node start – NextAuth env a Next.js betöltése előtt.
 */
const { createHash } = require('crypto')

const BUILTIN = 'gulumen-webshop-railway-nextauth-v3'

function env(key) {
  return (process.env[key] || '').trim() || undefined
}

function deriveFromDb() {
  const url = env('DATABASE_URL')
  if (!url) return undefined
  return createHash('sha256').update(`gulumen-nextauth:${url}`).digest('base64')
}

function resolveSecret() {
  return (
    env('NEXTAUTH_SECRET') ||
    env('JWT_SECRET') ||
    env('ADMIN_API_KEY') ||
    deriveFromDb() ||
    BUILTIN
  )
}

console.log('[start] gulumen-webshop bootstrap v3')

if (!env('NEXTAUTH_URL')) {
  process.env.NEXTAUTH_URL =
    env('NEXT_PUBLIC_APP_URL') ||
    (env('NODE_ENV') === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
}

const secret = resolveSecret()
if (!env('NEXTAUTH_SECRET')) {
  process.env.NEXTAUTH_SECRET = secret
}

console.log('[start] NextAuth secret:', secret ? 'ok' : 'MISSING')
console.log('[start] NextAuth URL:', process.env.NEXTAUTH_URL)
if (!env('DATABASE_URL')) {
  console.warn('[start] DATABASE_URL missing – link Postgres in Railway Variables')
}
