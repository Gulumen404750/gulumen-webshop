/**
 * Sentry – szerver oldal.
 * SENTRY_DSN nélkül: no-op (nem dob hibát).
 * DSN megadva: unhandled exception + 5xx request hibák a Sentry-be mennek.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN?.trim()
if (dsn) {
  try {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
      // Next.js App Router: automatikus request error capture (5xx / unhandled)
      enabled: true,
    })
  } catch (err) {
    console.warn('[sentry.server] init skipped (invalid DSN or config):', err)
  }
}
