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
  it('allows and flags unconfigured development', () => {
    const decision = evaluateAdminIpAccess('203.0.113.10', {
      NODE_ENV: 'development',
      ADMIN_ALLOWED_IPS: '',
    })
    expect(decision).toEqual({ ok: true, reason: 'unconfigured_dev' })
  })

  it('denies unconfigured production', () => {
    const decision = evaluateAdminIpAccess('203.0.113.10', {
      NODE_ENV: 'production',
      ADMIN_ALLOWED_IPS: '',
    })
    expect(decision).toEqual({ ok: false, reason: 'unconfigured_prod' })
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
})

describe('isAdminIpRestrictedPath', () => {
  it('covers admin UI and admin API', () => {
    expect(isAdminIpRestrictedPath('/admin')).toBe(true)
    expect(isAdminIpRestrictedPath('/admin/login')).toBe(true)
    expect(isAdminIpRestrictedPath('/api/admin/login')).toBe(true)
    expect(isAdminIpRestrictedPath('/api/admin/products')).toBe(true)
    expect(isAdminIpRestrictedPath('/api/products')).toBe(false)
    expect(isAdminIpRestrictedPath('/')).toBe(false)
  })
})
