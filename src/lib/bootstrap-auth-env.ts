/**
 * Production fail-fast: NEXTAUTH_SECRET / JWT_SECRET kötelező, nincs hardkódolt fallback.
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
 * Production-ben hiányzó / túl rövid secret esetén azonnal hibával leáll.
 * Dev/test környezetben csak figyelmeztet.
 */
export function assertAuthEnv(): void {
  const jwtSecret = process.env.JWT_SECRET?.trim()
  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim()
  const missing: string[] = []

  if (!secretOk(jwtSecret)) {
    missing.push(`JWT_SECRET (min ${MIN_SECRET_LENGTH} chars)`)
  }
  if (!secretOk(nextAuthSecret)) {
    missing.push(`NEXTAUTH_SECRET (min ${MIN_SECRET_LENGTH} chars)`)
  }

  if (missing.length === 0) return

  const message =
    `[bootstrap-auth-env] Missing or weak auth secrets: ${missing.join(', ')}. ` +
    'Set them via environment variables — no hardcoded fallback is allowed.'

  if (isProduction()) {
    throw new Error(message)
  }

  console.warn(message)
}

/** Side-effect import: assert on load when required. */
export function bootstrapAuthEnv(): void {
  assertAuthEnv()
}
