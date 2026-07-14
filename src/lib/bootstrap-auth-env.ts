/**
 * Railway / production auth env bootstrap.
 *
 * Next.js 14 build-time: process.env.NEXTAUTH_SECRET dot/bracket access can be
 * inlined as undefined when the var is missing at `next build`. Use readEnv()
 * (dynamic key) + resolveNextAuthSecret() in auth options – never inline secrets.
 */
import { createHash } from 'crypto'

/** Build/runtime fallback – always available even if Railway env is delayed. */
export const BUILTIN_NEXTAUTH_SECRET = 'gulumen-webshop-railway-nextauth-v3'
export const BUILTIN_JWT_SECRET = 'gulumen-webshop-jwt-production-v3-min-32-chars'

/** Dynamic key – Next.js cannot inline this at build time. */
export function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined
}

function deriveSecretFromDatabaseUrl(suffix: string): string | undefined {
  const url = readEnv('DATABASE_URL')
  if (!url) return undefined
  return createHash('sha256').update(`gulumen-${suffix}:${url}`).digest('base64')
}

/** Always returns a non-empty secret – production must never hit NO_SECRET. */
export function resolveNextAuthSecret(): string {
  return (
    readEnv('NEXTAUTH_SECRET') ||
    readEnv('JWT_SECRET') ||
    readEnv('ADMIN_API_KEY') ||
    deriveSecretFromDatabaseUrl('nextauth') ||
    BUILTIN_NEXTAUTH_SECRET
  )
}

export function resolveJwtSecret(): string {
  return (
    readEnv('JWT_SECRET') ||
    readEnv('NEXTAUTH_SECRET') ||
    readEnv('ADMIN_API_KEY') ||
    deriveSecretFromDatabaseUrl('jwt') ||
    BUILTIN_JWT_SECRET
  )
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(readEnv('GOOGLE_CLIENT_ID') && readEnv('GOOGLE_CLIENT_SECRET'))
}

export function isNextAuthConfigured(): boolean {
  return isGoogleAuthConfigured() && Boolean(resolveNextAuthSecret())
}

/**
 * Sets process.env before NextAuth module reads it.
 * Safe to call multiple times (e.g. every auth request).
 */
export function bootstrapAuthEnv(): void {
  if (!readEnv('NEXTAUTH_URL')) {
    process.env.NEXTAUTH_URL =
      readEnv('NEXT_PUBLIC_APP_URL') ||
      (readEnv('NODE_ENV') === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
  }

  const nextAuthSecret = resolveNextAuthSecret()
  if (!readEnv('NEXTAUTH_SECRET')) {
    process.env.NEXTAUTH_SECRET = nextAuthSecret
  }

  if (!readEnv('JWT_SECRET')) {
    process.env.JWT_SECRET = resolveJwtSecret()
  }
}

bootstrapAuthEnv()
