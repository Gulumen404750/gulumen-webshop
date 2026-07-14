/**
 * Node start – NextAuth env a Next.js betöltése előtt.
 * Dynamic key env reads – build-time inline elkerülés.
 */
const { createHash } = require('crypto')

const BUILTIN = 'gulumen-webshop-railway-nextauth-v3'
const BUILTIN_JWT = 'gulumen-webshop-jwt-production-v3-min-32-chars'

function readEnv(key) {
  return (process.env[key] || '').trim() || undefined
}

function deriveFromDb(suffix = 'nextauth') {
  const url = readEnv('DATABASE_URL')
  if (!url) return undefined
  return createHash('sha256').update(`gulumen-${suffix}:${url}`).digest('base64')
}

function resolveSecret() {
  return (
    readEnv('NEXTAUTH_SECRET') ||
    readEnv('JWT_SECRET') ||
    readEnv('ADMIN_API_KEY') ||
    deriveFromDb('nextauth') ||
    BUILTIN
  )
}

function resolveJwt() {
  return (
    readEnv('JWT_SECRET') ||
    readEnv('NEXTAUTH_SECRET') ||
    readEnv('ADMIN_API_KEY') ||
    deriveFromDb('jwt') ||
    BUILTIN_JWT
  )
}

if (!readEnv('NEXTAUTH_URL')) {
  process.env.NEXTAUTH_URL =
    readEnv('NEXT_PUBLIC_APP_URL') ||
    (readEnv('NODE_ENV') === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
}

const secret = resolveSecret()
process.env.NEXTAUTH_SECRET = secret

if (!readEnv('JWT_SECRET')) {
  process.env.JWT_SECRET = resolveJwt()
}

console.log('[start] NextAuth secret:', secret ? 'ok' : 'MISSING')
console.log('[start] JWT secret:', readEnv('JWT_SECRET') ? 'ok' : 'MISSING')
console.log('[start] NextAuth URL:', process.env.NEXTAUTH_URL)
if (!readEnv('DATABASE_URL')) {
  console.warn('[start] DATABASE_URL missing – link Postgres in Railway Variables')
}
