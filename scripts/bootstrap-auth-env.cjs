/**
 * Node start – NextAuth env a Next.js betöltése előtt.
 * Production: NINCS hardkódolt fallback secret – fail-fast ha hiányzik.
 */
const { createHash } = require('crypto')
const { ensureProductionUrls } = require('./ensure-production-url.cjs')

const MIN = 16

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

function secretOk(value) {
  return Boolean(value && value.length >= MIN)
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

function resolveSecret() {
  const nextAuth = readEnv('NEXTAUTH_SECRET')
  if (secretOk(nextAuth)) return nextAuth
  const jwt = readEnv('JWT_SECRET')
  if (secretOk(jwt)) return jwt

  if (isProductionContext()) {
    console.error(
      '[start] FATAL: NEXTAUTH_SECRET or JWT_SECRET required in production (min 16 chars). No hardcoded fallback.'
    )
    process.exit(1)
  }

  const url = readEnv('DATABASE_URL')
  if (url) return createHash('sha256').update(`gulumen-nextauth-dev:${url}`).digest('base64')
  return 'local-dev-nextauth-secret'
}

function resolveJwt() {
  const jwt = readEnv('JWT_SECRET')
  if (secretOk(jwt)) return jwt
  const nextAuth = readEnv('NEXTAUTH_SECRET')
  if (secretOk(nextAuth)) return nextAuth

  if (isProductionContext()) {
    console.error(
      '[start] FATAL: JWT_SECRET or NEXTAUTH_SECRET required in production (min 16 chars). No hardcoded fallback.'
    )
    process.exit(1)
  }

  const url = readEnv('DATABASE_URL')
  if (url) return createHash('sha256').update(`gulumen-jwt-dev:${url}`).digest('base64')
  return 'local-dev-jwt-secret-16'
}

ensureProductionUrls('start')

process.env.NEXT_PUBLIC_APP_URL = resolvePublicAppUrl()
process.env.NEXTAUTH_URL = resolveNextAuthUrl()

const secret = resolveSecret()
process.env.NEXTAUTH_SECRET = secret

if (!secretOk(readEnv('JWT_SECRET'))) {
  process.env.JWT_SECRET = resolveJwt()
}

console.log('[start] NextAuth secret:', secretOk(readEnv('NEXTAUTH_SECRET')) ? 'ok' : 'MISSING')
console.log('[start] JWT secret:', secretOk(readEnv('JWT_SECRET')) ? 'ok' : 'MISSING')
console.log('[start] NextAuth URL:', process.env.NEXTAUTH_URL)
console.log('[start] App URL:', process.env.NEXT_PUBLIC_APP_URL)
if (!readEnv('DATABASE_URL')) {
  console.warn('[start] DATABASE_URL missing – link Postgres in Railway Variables')
}
