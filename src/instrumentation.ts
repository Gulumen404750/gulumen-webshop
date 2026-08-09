/**
 * Next.js instrumentation – server induláskor fut.
 * Production: fail-fast ha hiányzik JWT_SECRET / NEXTAUTH_SECRET.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapAuthEnv } = await import('./lib/bootstrap-auth-env')
    bootstrapAuthEnv()
  }
}
