import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Sentry config: DSN nélkül ne dobjon, DSN-nel init + 5xx capture útvonal megvan.
 * (A tényleges @sentry/nextjs init-et nem futtatjuk unitban.)
 */
describe('Sentry init guards', () => {
  const root = process.cwd()

  it('server config only inits when SENTRY_DSN is set', () => {
    const src = readFileSync(join(root, 'sentry.server.config.ts'), 'utf-8')
    expect(src).toMatch(/process\.env\.SENTRY_DSN/)
    expect(src).toMatch(/if \(dsn\)/)
    expect(src).toMatch(/try\s*\{[\s\S]*Sentry\.init/)
  })

  it('client config accepts NEXT_PUBLIC_SENTRY_DSN or SENTRY_DSN', () => {
    const src = readFileSync(join(root, 'sentry.client.config.ts'), 'utf-8')
    expect(src).toMatch(/NEXT_PUBLIC_SENTRY_DSN/)
    expect(src).toMatch(/if \(dsn\)/)
    expect(src).toMatch(/try\s*\{[\s\S]*Sentry\.init/)
  })

  it('instrumentation loads sentry configs and captures request errors when DSN present', () => {
    const src = readFileSync(join(root, 'src/instrumentation.ts'), 'utf-8')
    expect(src).toMatch(/sentry\.server\.config/)
    expect(src).toMatch(/onRequestError/)
    expect(src).toMatch(/captureException/)
    expect(src).toMatch(/SENTRY_DSN/)
  })

  it('next.config only wraps withSentryConfig when SENTRY_DSN is set', () => {
    const src = readFileSync(join(root, 'next.config.js'), 'utf-8')
    expect(src).toMatch(/process\.env\.SENTRY_DSN/)
    expect(src).toMatch(/withSentryConfig/)
  })
})
