/**
 * Node start – NextAuth env a Next.js betöltése előtt.
 */
const { createHash } = require('crypto')

const BUILTIN = 'gulumen-webshop-railway-nextauth-v3'
const BUILTIN_JWT = 'gulumen-webshop-jwt-production-v3-min-32-chars'

function env(key) {
  return (process.env[key] || '').trim() || undefined
}

function deriveFromDb(suffix = 'nextauth') {
  const url = env('DATABASE_URL')
  if (!url) return undefined
  return createHash('sha256').update(`gulumen-${suffix}:${url}`).digest('base64')
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

console.log('[start] gulumen-webshop bootstrap v4')

if (!env('NEXTAUTH_URL')) {
  process.env.NEXTAUTH_URL =
    env('NEXT_PUBLIC_APP_URL') ||
    (env('NODE_ENV') === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
}

const secret = resolveSecret()
if (!env('NEXTAUTH_SECRET')) {
  process.env.NEXTAUTH_SECRET = secret
}

if (!env('JWT_SECRET')) {
  process.env.JWT_SECRET = env('ADMIN_API_KEY') || deriveFromDb('jwt') || BUILTIN_JWT
}

console.log('[start] NextAuth secret:', secret ? 'ok' : 'MISSING')
console.log('[start] JWT secret:', env('JWT_SECRET') ? 'ok' : 'MISSING')
console.log('[start] NextAuth URL:', process.env.NEXTAUTH_URL)
if (!env('DATABASE_URL')) {
  console.warn('[start] DATABASE_URL missing – link Postgres in Railway Variables')
}
