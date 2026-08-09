/**
 * Railway / production auth env bootstrap.
 *
 * Production: NINCS hardkódolt fallback secret.
 * Ha hiányzik JWT_SECRET és NEXTAUTH_SECRET is → fail-fast.
 * Ha csak az egyik van meg, a másik azt aliasolja.
 */
import { createHash } from 'crypto'

export const PRODUCTION_APP_URL = 'https://www.gulumen.com'
const MIN_SECRET_LENGTH = 16

/** Dynamic key – Next.js cannot inline this at build time. */
export function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined
}

function setEnv(key: string, value: string): void {
  process.env[key] = value
}

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url)
  }
}

export function isProductionRuntime(): boolean {
  return (
    readEnv('NODE_ENV') === 'production' ||
    Boolean(readEnv('RAILWAY_ENVIRONMENT')) ||
    Boolean(readEnv('RAILWAY_PROJECT_ID')) ||
    Boolean(readEnv('DATABASE_URL')?.includes('railway.internal'))
  )
}

/** next build alatt ne fail-fast – a start.js / cjs bootstrap védi a runtime-ot. */
function isBuildTime(): boolean {
  return (
    readEnv('NEXT_PHASE') === 'phase-production-build' ||
    readEnv('npm_lifecycle_event') === 'build' ||
    process.argv.some((a) => a.includes('next') && process.argv.includes('build'))
  )
}

function secretOk(value: string | undefined): boolean {
  return Boolean(value && value.length >= MIN_SECRET_LENGTH)
}

/** Public app URL – productionben soha nem localhost. */
export function resolvePublicAppUrl(): string {
  const fromEnv = readEnv('NEXT_PUBLIC_APP_URL')
  if (fromEnv && !(isProductionRuntime() && isLocalhostUrl(fromEnv))) {
    return fromEnv.replace(/\/$/, '')
  }
  if (isProductionRuntime()) return PRODUCTION_APP_URL
  return fromEnv || 'http://localhost:3000'
}

/** NextAuth callback base URL. */
export function resolveNextAuthUrl(): string {
  const fromEnv = readEnv('NEXTAUTH_URL')
  if (fromEnv && !(isProductionRuntime() && isLocalhostUrl(fromEnv))) {
    return fromEnv.replace(/\/$/, '')
  }
  return resolvePublicAppUrl()
}

/**
 * Production: csak env secret (JWT_SECRET vagy NEXTAUTH_SECRET).
 * Dev: enyhe local fallback a fejlesztéshez (soha nem production).
 */
export function resolveNextAuthSecret(): string {
  const nextAuth = readEnv('NEXTAUTH_SECRET')
  if (secretOk(nextAuth)) return nextAuth!
  const jwt = readEnv('JWT_SECRET')
  if (secretOk(jwt)) return jwt!

  if (isProductionRuntime() && !isBuildTime()) {
    throw new Error(
      '[bootstrap-auth-env] FATAL: NEXTAUTH_SECRET or JWT_SECRET required in production (min 16 chars). No hardcoded fallback.'
    )
  }

  // Build / local dev only – never used as production runtime fallback (start.js fail-fast).
  const url = readEnv('DATABASE_URL')
  if (url) {
    return createHash('sha256').update(`gulumen-nextauth-dev:${url}`).digest('base64')
  }
  return 'local-dev-nextauth-secret'
}

export function resolveJwtSecret(): string {
  const jwt = readEnv('JWT_SECRET')
  if (secretOk(jwt)) return jwt!
  const nextAuth = readEnv('NEXTAUTH_SECRET')
  if (secretOk(nextAuth)) return nextAuth!

  if (isProductionRuntime() && !isBuildTime()) {
    throw new Error(
      '[bootstrap-auth-env] FATAL: JWT_SECRET or NEXTAUTH_SECRET required in production (min 16 chars). No hardcoded fallback.'
    )
  }

  const url = readEnv('DATABASE_URL')
  if (url) {
    return createHash('sha256').update(`gulumen-jwt-dev:${url}`).digest('base64')
  }
  return 'local-dev-jwt-secret-16'
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(readEnv('GOOGLE_CLIENT_ID') && readEnv('GOOGLE_CLIENT_SECRET'))
}

export function isNextAuthConfigured(): boolean {
  return isGoogleAuthConfigured() && Boolean(resolveNextAuthSecret())
}

/**
 * Sets process.env before NextAuth module reads it.
 * Production: fail-fast ha egyik secret sincs.
 */
export function bootstrapAuthEnv(): void {
  const appUrl = resolvePublicAppUrl()
  const nextAuthUrl = resolveNextAuthUrl()

  setEnv('NEXT_PUBLIC_APP_URL', appUrl)
  setEnv('NEXTAUTH_URL', nextAuthUrl)

  const nextAuthSecret = resolveNextAuthSecret()
  setEnv('NEXTAUTH_SECRET', nextAuthSecret)

  if (!secretOk(readEnv('JWT_SECRET'))) {
    setEnv('JWT_SECRET', resolveJwtSecret())
  }
}

try {
  bootstrapAuthEnv()
} catch (err) {
  // Build-time / incomplete env: start.js (cjs) enforced fail-fast in production runtime.
  console.warn('[bootstrap-auth-env]', err instanceof Error ? err.message : err)
}
