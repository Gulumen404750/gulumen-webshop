/**
 * Railway / production: NEXTAUTH_SECRET és NEXTAUTH_URL gyakran nincs külön beállítva.
 * Fallback JWT_SECRET → ADMIN_API_KEY, URL → NEXT_PUBLIC_APP_URL.
 * Importáld auth-options betöltése előtt (auth-options.ts elején).
 */
function bootstrapAuthEnv(): void {
  if (!process.env.NEXTAUTH_URL?.trim()) {
    process.env.NEXTAUTH_URL =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.NODE_ENV === 'production' ? 'https://www.gulumen.com' : 'http://localhost:3000')
  }

  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    const fallback = process.env.JWT_SECRET?.trim() || process.env.ADMIN_API_KEY?.trim()
    if (fallback) {
      process.env.NEXTAUTH_SECRET = fallback
    }
  }
}

bootstrapAuthEnv()
