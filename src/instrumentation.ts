/**
 * Next.js instrumentation – server induláskor fut.
 * Fail-fast a scripts/start.js-ben történik; itt csak best-effort check.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { bootstrapAuthEnv } = await import('./lib/bootstrap-auth-env')
      bootstrapAuthEnv()
    } catch (err) {
      console.error('[instrumentation] bootstrap-auth-env failed:', err)
      // Ne döntse el a process-t itt — a start.js már fail-fast-el indulás előtt.
    }
  }
}
