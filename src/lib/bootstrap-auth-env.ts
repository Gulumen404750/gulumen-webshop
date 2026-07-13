/**
 * Railway / production: NEXTAUTH_SECRET és NEXTAUTH_URL gyakran nincs külön beállítva.
 * Fallback: JWT_SECRET → ADMIN_API_KEY → DATABASE_URL hash.
 */
import { createHash } from 'crypto'

function deriveSecretFromDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return undefined
  return createHash('sha256').update(`gulumen-nextauth:${url}`).digest('base64')
}

export function resolveNextAuthSecret(): string | undefined {
  return (
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.ADMIN_API_KEY?.trim() ||
    deriveSecretFromDatabaseUrl()
  )
}

export function isNextAuthConfigured(): boolean {
  return Boolean(resolveNextAuthSecret())
}

function bootstrapAuthEnv(): void {
  if (!process.env.NEXTAUTH_URL?.trim()) {
    process.env.NEXTAUTH_URL =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.NODE_ENV === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
  }

  const secret = resolveNextAuthSecret()
  if (secret && !process.env.NEXTAUTH_SECRET?.trim()) {
    process.env.NEXTAUTH_SECRET = secret
  }
}

bootstrapAuthEnv()
