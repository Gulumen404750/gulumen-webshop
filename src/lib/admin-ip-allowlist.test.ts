import { describe, expect, it } from 'vitest'
import {
  evaluateAdminIpAccess,
  isAdminIpRestrictedPath,
  isIpAllowed,
  parseAdminAllowedIps,
} from './admin-ip-allowlist'

describe('parseAdminAllowedIps', () => {
  it('splits comma-separated values', () => {
    expect(parseAdminAllowedIps(' 127.0.0.1, 10.0.0.0/8 , ')).toEqual([
      '127.0.0.1',
      '10.0.0.0/8',
    ])
  })

  it('returns empty for blank input', () => {
    expect(parseAdminAllowedIps('')).toEqual([])
    expect(parseAdminAllowedIps(undefined)).toEqual([])
  })
})

describe('isIpAllowed', () => {
  it('matches exact IPv4', () => {
    expect(isIpAllowed('203.0.113.10', ['203.0.113.10'])).toBe(true)
    expect(isIpAllowed('203.0.113.11', ['203.0.113.10'])).toBe(false)
  })

  it('matches IPv4 CIDR', () => {
    expect(isIpAllowed('10.1.2.3', ['10.0.0.0/8'])).toBe(true)
    expect(isIpAllowed('11.0.0.1', ['10.0.0.0/8'])).toBe(false)
  })

  it('allows * wildcard', () => {
    expect(isIpAllowed('203.0.113.10', ['*'])).toBe(true)
  })
})

describe('evaluateAdminIpAccess', () => {
  it('allows when the allowlist is unset in development', () => {
    const decision = evaluateAdminIpAccess('203.0.113.10', {
      NODE_ENV: 'development',
      ADMIN_ALLOWED_IPS: '',
    })
    expect(decision).toEqual({ ok: true, reason: 'unconfigured' })
  })

  it('blocks all admin IPs when the allowlist is unset in production', () => {
    const decision = evaluateAdminIpAccess('203.0.113.10', {
      NODE_ENV: 'production',
      ADMIN_ALLOWED_IPS: '',
    })
    expect(decision).toEqual({ ok: false, reason: 'unconfigured' })
  })

  it('still allows an unset list in test', () => {
    const decision = evaluateAdminIpAccess('203.0.113.10', {
      NODE_ENV: 'test',
      ADMIN_ALLOWED_IPS: '',
    })
    expect(decision).toEqual({ ok: true, reason: 'unconfigured' })
  })

  it('denies unknown client IPs when an allowlist is set', () => {
    const decision = evaluateAdminIpAccess('unknown', {
      NODE_ENV: 'production',
      ADMIN_ALLOWED_IPS: '203.0.113.10',
    })
    expect(decision).toEqual({ ok: false, reason: 'denied' })
  })

  it('denies IPs outside the allowlist', () => {
    const decision = evaluateAdminIpAccess('198.51.100.1', {
      NODE_ENV: 'production',
      ADMIN_ALLOWED_IPS: '203.0.113.10',
    })
    expect(decision).toEqual({ ok: false, reason: 'denied' })
  })

  it('allows listed IPs in production', () => {
    const decision = evaluateAdminIpAccess('203.0.113.10', {
      NODE_ENV: 'production',
      ADMIN_ALLOWED_IPS: '203.0.113.10,10.0.0.0/8',
    })
    expect(decision).toEqual({ ok: true, reason: 'allowed' })
  })

  it('allows * in production as an explicit opt-out', () => {
    expect(
      evaluateAdminIpAccess('198.51.100.1', {
        NODE_ENV: 'production',
        ADMIN_ALLOWED_IPS: '*',
      })
    ).toEqual({ ok: true, reason: 'allowed' })
  })
})

describe('isAdminIpRestrictedPath', () => {
  it('covers admin UI and admin API', () => {
    expect(isAdminIpRestrictedPath('/admin')).toBe(true)
    expect(isAdminIpRestrictedPath('/admin/login')).toBe(true)
    expect(isAdminIpRestrictedPath('/admin/reset')).toBe(true)
    expect(isAdminIpRestrictedPath('/api/admin/login')).toBe(true)
    expect(isAdminIpRestrictedPath('/api/admin/reset/request')).toBe(true)
    expect(isAdminIpRestrictedPath('/api/admin/products')).toBe(true)
    expect(isAdminIpRestrictedPath('/api/products')).toBe(false)
    expect(isAdminIpRestrictedPath('/')).toBe(false)
  })

  it('covers the hidden slug when ADMIN_URL_SLUG is set', () => {
    const prev = process.env.ADMIN_URL_SLUG
    process.env.ADMIN_URL_SLUG = 'desk-a1b2c3d4'
    try {
      expect(isAdminIpRestrictedPath('/desk-a1b2c3d4/login')).toBe(true)
      expect(isAdminIpRestrictedPath('/api/desk-a1b2c3d4/orders')).toBe(true)
      expect(isAdminIpRestrictedPath('/termekek')).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.ADMIN_URL_SLUG
      else process.env.ADMIN_URL_SLUG = prev
    }
  })
})
