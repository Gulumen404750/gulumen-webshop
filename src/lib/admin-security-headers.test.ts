import { describe, expect, it } from 'vitest'
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  generateCspNonce,
  PERMISSIONS_POLICY,
} from './admin-security-headers'

describe('buildContentSecurityPolicy', () => {
  it('omits unsafe-eval and unsafe-inline in production when a nonce is set', () => {
    const csp = buildContentSecurityPolicy(false, 'testNonceAbc')
    const scriptSrc = csp.split(';').find((part) => part.trim().startsWith('script-src')) ?? ''
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).toContain("'nonce-testNonceAbc'")
    expect(scriptSrc).toContain("'strict-dynamic'")
    expect(csp).toContain('https://ajax.googleapis.com')
    expect(csp).toContain('https://www.google.com')
    expect(csp).toContain('https://www.gstatic.com')
    expect(csp).toContain('https://www.recaptcha.net')
    expect(csp).toContain('https://www.googletagmanager.com')
    expect(csp).toContain("frame-src 'self' https://www.google.com https://www.recaptcha.net")
    expect(csp).toContain("object-src 'none'")
  })

  it('omits unsafe-eval and unsafe-inline from script-src in production even without a nonce', () => {
    const csp = buildContentSecurityPolicy(false)
    const scriptSrc = csp.split(';').find((part) => part.trim().startsWith('script-src')) ?? ''
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).toContain("script-src 'self'")
  })

  it('keeps unsafe-eval in development for Next.js HMR', () => {
    const csp = buildContentSecurityPolicy(true)
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain("'unsafe-inline'")
  })
})

describe('generateCspNonce', () => {
  it('returns unique base64 values', () => {
    const a = generateCspNonce()
    const b = generateCspNonce()
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(16)
  })
})

describe('applySecurityHeaders', () => {
  it('sets production CSP with nonce on the response', () => {
    const headers = new Headers()
    applySecurityHeaders(headers, false, 'hdrNonce')
    const csp = headers.get('Content-Security-Policy') ?? ''
    const scriptSrc = csp.split(';').find((part) => part.trim().startsWith('script-src')) ?? ''
    expect(scriptSrc).toContain("'nonce-hdrNonce'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})

describe('PERMISSIONS_POLICY', () => {
  it('disables camera, microphone, geolocation and payment', () => {
    expect(PERMISSIONS_POLICY).toContain('camera=()')
    expect(PERMISSIONS_POLICY).toContain('microphone=()')
    expect(PERMISSIONS_POLICY).toContain('geolocation=()')
    expect(PERMISSIONS_POLICY).toContain('payment=()')
  })
})
