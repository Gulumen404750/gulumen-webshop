import { describe, expect, it } from 'vitest'
import { getClientIp, normalizeIp } from './request-ip'

describe('normalizeIp', () => {
  it('strips IPv4-mapped IPv6 prefix', () => {
    expect(normalizeIp('::ffff:203.0.113.10')).toBe('203.0.113.10')
  })

  it('strips IPv4 port', () => {
    expect(normalizeIp('203.0.113.10:443')).toBe('203.0.113.10')
  })

  it('keeps IPv6 without brackets', () => {
    expect(normalizeIp('[2001:db8::1]')).toBe('2001:db8::1')
  })
})

describe('getClientIp', () => {
  it('uses the first x-forwarded-for hop', () => {
    const request = new Request('http://localhost/admin', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    })
    expect(getClientIp(request)).toBe('203.0.113.10')
  })

  it('falls back to cf-connecting-ip then x-real-ip', () => {
    const cf = new Request('http://localhost/admin', {
      headers: { 'cf-connecting-ip': '198.51.100.2' },
    })
    expect(getClientIp(cf)).toBe('198.51.100.2')

    const real = new Request('http://localhost/admin', {
      headers: { 'x-real-ip': '198.51.100.3' },
    })
    expect(getClientIp(real)).toBe('198.51.100.3')
  })

  it('returns unknown when no headers', () => {
    expect(getClientIp(new Request('http://localhost/admin'))).toBe('unknown')
  })
})
