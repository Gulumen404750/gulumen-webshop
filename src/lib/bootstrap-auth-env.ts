/**
 * Railway / production: NEXTAUTH_SECRET és NEXTAUTH_URL gyakran nincs külön beállítva.
 * Fallback: JWT_SECRET → ADMIN_API_KEY → DATABASE_URL hash → app production secret.
 */
import { createHash } from 'crypto'

const PRODUCTION_FALLBACK_SECRET = createHash('sha256')
  .update('gulumen-webshop-production-nextauth-v2')
  .digest('base64')

function deriveSecretFromDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return undefined
  return createHash('sha256').update(`gulumen-nextauth:${url}`).digest('base64')
}

/** Mindig ad vissza titkot – productionben soha nem NO_SECRET. */
export function resolveNextAuthSecret(): string {
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

export function isNextAuthConfigured(): boolean {
  return Boolean(resolveNextAuthSecret())
}

export function bootstrapAuthEnv(): void {
  if (!process.env.NEXTAUTH_URL?.trim()) {
    process.env.NEXTAUTH_URL =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.NODE_ENV === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
  }

  const secret = resolveNextAuthSecret()
  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    process.env.NEXTAUTH_SECRET = secret
  }
}

bootstrapAuthEnv()
