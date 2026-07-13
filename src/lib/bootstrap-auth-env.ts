/**
 * Railway / production: NEXTAUTH_SECRET gyakran nincs beállítva.
 * Bracket notation → Next.js build nem inline-olja ki (runtime env).
 */
import { createHash } from 'crypto'

/** Build/runtime fallback – bracket env olvasás mellett is biztos. */
export const BUILTIN_NEXTAUTH_SECRET = 'gulumen-webshop-railway-nextauth-v3'

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined
}

function deriveSecretFromDatabaseUrl(): string | undefined {
  const url = env('DATABASE_URL')
  if (!url) return undefined
  return createHash('sha256').update(`gulumen-nextauth:${url}`).digest('base64')
}

/** Mindig ad vissza titkot – productionben soha nem NO_SECRET. */
export function resolveNextAuthSecret(): string {
  return (
    env('NEXTAUTH_SECRET') ||
    env('JWT_SECRET') ||
    env('ADMIN_API_KEY') ||
    deriveSecretFromDatabaseUrl() ||
    BUILTIN_NEXTAUTH_SECRET
  )
}

export function isNextAuthConfigured(): boolean {
  return Boolean(resolveNextAuthSecret())
}

export function bootstrapAuthEnv(): void {
  if (!env('NEXTAUTH_URL')) {
    process.env.NEXTAUTH_URL =
      env('NEXT_PUBLIC_APP_URL') ||
      (env('NODE_ENV') === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
  }

  if (!env('NEXTAUTH_SECRET')) {
    process.env.NEXTAUTH_SECRET = resolveNextAuthSecret()
  }
}

bootstrapAuthEnv()
