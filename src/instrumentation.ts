/**
 * Next.js instrumentation – auth bootstrap + opcionális Sentry betöltés.
 * SENTRY_DSN hiányában a sentry config no-op; nem dob hibát.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/bootstrap-auth-env')
    // Server Sentry: csak ha DSN van (a config maga is őrzi)
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

/**
 * Next.js request hibák (pl. 5xx / unhandled route error) → Sentry.
 * DSN nélkül a capture no-op.
 */
export async function onRequestError(
  err: unknown,
  request: {
    path: string
    method: string
    headers: { get(name: string): string | null | undefined }
  },
  context: { routerKind?: string; routePath?: string; routeType?: string }
) {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(err, {
      tags: {
        path: request.path,
        method: request.method,
        routerKind: context.routerKind ?? 'unknown',
        routePath: context.routePath ?? 'unknown',
        routeType: context.routeType ?? 'unknown',
      },
    })
  } catch {
    // Sentry nem elérhető / init hiba – soha ne törje a request lifecycle-t
  }
}
