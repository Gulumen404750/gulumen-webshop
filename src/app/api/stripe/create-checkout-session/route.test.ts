import { describe, expect, it } from 'vitest'
import { GET, POST } from './route'

describe('legacy /api/stripe/create-checkout-session', () => {
  it('POST returns 410 and points to /api/checkout', async () => {
    const res = await POST()
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.code).toBe('legacy_stripe_checkout_removed')
    expect(body.use).toBe('/api/checkout')
    expect(res.headers.get('Deprecation')).toBe('true')
  })

  it('GET returns 410', async () => {
    const res = await GET()
    expect(res.status).toBe(410)
  })
})
