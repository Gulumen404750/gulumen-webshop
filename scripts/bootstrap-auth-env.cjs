/**
 * Node start – NextAuth env a Next.js betöltése előtt.
 * Dynamic key env reads – build-time inline elkerülés.
 */
const { createHash } = require('crypto')
const { ensureProductionUrls } = require('./ensure-production-url.cjs')

const BUILTIN = 'gulumen-webshop-railway-nextauth-v3'
const BUILTIN_JWT = 'gulumen-webshop-jwt-production-v3-min-32-chars'

function readEnv(key) {
  return (process.env[key] || '').trim() || undefined
}

function isLocalhostUrl(url) {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url)
  }
}

function isProductionContext() {
  return (
    readEnv('NODE_ENV') === 'production' ||
    Boolean(readEnv('RAILWAY_ENVIRONMENT')) ||
    Boolean(readEnv('RAILWAY_PROJECT_ID')) ||
    Boolean(readEnv('DATABASE_URL')?.includes('railway.internal'))
  )
}

function resolvePublicAppUrl() {
  const fromEnv = readEnv('NEXT_PUBLIC_APP_URL')
  if (fromEnv && !(isProductionContext() && isLocalhostUrl(fromEnv))) {
    return fromEnv.replace(/\/$/, '')
  }
  if (isProductionContext()) return 'https://www.gulumen.com'
  return fromEnv || 'http://localhost:3000'
}

function resolveNextAuthUrl() {
  const fromEnv = readEnv('NEXTAUTH_URL')
  if (fromEnv && !(isProductionContext() && isLocalhostUrl(fromEnv))) {
    return fromEnv.replace(/\/$/, '')
  }
  return resolvePublicAppUrl()
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

ensureProductionUrls('start')

process.env.NEXT_PUBLIC_APP_URL = resolvePublicAppUrl()
process.env.NEXTAUTH_URL = resolveNextAuthUrl()

const secret = resolveSecret()
process.env.NEXTAUTH_SECRET = secret

if (!readEnv('JWT_SECRET')) {
  process.env.JWT_SECRET = resolveJwt()
}

console.log('[start] NextAuth secret:', secret ? 'ok' : 'MISSING')
console.log('[start] JWT secret:', readEnv('JWT_SECRET') ? 'ok' : 'MISSING')
console.log('[start] NextAuth URL:', process.env.NEXTAUTH_URL)
console.log('[start] App URL:', process.env.NEXT_PUBLIC_APP_URL)
if (!readEnv('DATABASE_URL')) {
  console.warn('[start] DATABASE_URL missing – link Postgres in Railway Variables')
}
