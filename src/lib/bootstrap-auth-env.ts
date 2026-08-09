/**
 * Production fail-fast: JWT_SECRET kötelező, nincs hardkódolt fallback secret.
 * Ha NEXTAUTH_SECRET hiányzik, JWT_SECRET-et használjuk (alias, nem hardkódolt érték).
 * Hívd instrumentation.ts-ből és scripts/start.js-ből indulás előtt.
 */

const MIN_SECRET_LENGTH = 16

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function secretOk(value: string | undefined): boolean {
  return Boolean(value && value.trim().length >= MIN_SECRET_LENGTH)
}

/**
 * Production-ben hiányzó / túl rövid JWT_SECRET esetén azonnal hibával leáll.
 * NEXTAUTH_SECRET hiányában JWT_SECRET-re állítjuk (nincs hardkódolt fallback).
 */
export function assertAuthEnv(): void {
  const jwtSecret = process.env.JWT_SECRET?.trim()

  if (!secretOk(jwtSecret)) {
    const message =
      `[bootstrap-auth-env] Missing or weak JWT_SECRET (min ${MIN_SECRET_LENGTH} chars). ` +
      'Set it via environment variables — no hardcoded fallback is allowed.'
    if (isProduction()) {
      throw new Error(message)
    }
    console.warn(message)
    return
  }

  if (!secretOk(process.env.NEXTAUTH_SECRET)) {
    // Alias: ne hardkódolt secret, hanem a már beállított JWT_SECRET.
    process.env.NEXTAUTH_SECRET = jwtSecret
    if (isProduction()) {
      console.warn(
        '[bootstrap-auth-env] NEXTAUTH_SECRET missing — using JWT_SECRET as NEXTAUTH_SECRET (set NEXTAUTH_SECRET explicitly when possible).'
      )
    }
  }
}

/** Side-effect import: assert on load when required. */
export function bootstrapAuthEnv(): void {
  assertAuthEnv()
}
