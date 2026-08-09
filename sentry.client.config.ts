/**
 * Sentry – kliens oldal.
 * NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN nélkül: no-op (nem dob hibát).
 */
import * as Sentry from '@sentry/nextjs'

const dsn = (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN)?.trim()
if (dsn) {
  try {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
      enabled: true,
    })
  } catch (err) {
    console.warn('[sentry.client] init skipped (invalid DSN or config):', err)
  }
}
