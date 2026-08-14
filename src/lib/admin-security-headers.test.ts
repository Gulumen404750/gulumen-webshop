import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, PERMISSIONS_POLICY } from './admin-security-headers'

describe('buildContentSecurityPolicy', () => {
  it('omits unsafe-eval in production', () => {
    const csp = buildContentSecurityPolicy(false)
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://ajax.googleapis.com")
    expect(csp).toContain('https://www.google.com')
    expect(csp).toContain('https://www.gstatic.com')
    expect(csp).toContain("frame-src 'self' https://www.google.com https://www.recaptcha.net")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain('upgrade-insecure-requests')
  })

  it('keeps unsafe-eval in development for Next.js HMR', () => {
    const csp = buildContentSecurityPolicy(true)
    expect(csp).toContain("'unsafe-eval'")
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
