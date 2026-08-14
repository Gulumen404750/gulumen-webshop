import { describe, expect, it } from 'vitest'
import {
  BOOTSTRAP_ADMIN_ACTOR,
  isAdminRole,
  navPermissionForHref,
  parseAdminPassword,
  parseAdminUsername,
  permissionsForRole,
  redactCustomerPii,
  roleHasPermission,
} from './admin-rbac'

describe('admin RBAC', () => {
  it('maps owner vs support vs catalog privileges', () => {
    expect(roleHasPermission('owner', 'customers:pii')).toBe(true)
    expect(roleHasPermission('owner', 'products:delete')).toBe(true)
    expect(roleHasPermission('owner', 'products:write')).toBe(true)
    expect(roleHasPermission('owner', 'orders:export')).toBe(true)

    expect(roleHasPermission('support', 'customers:pii')).toBe(true)
    expect(roleHasPermission('support', 'orders:write')).toBe(true)
    expect(roleHasPermission('support', 'products:write')).toBe(false)
    expect(roleHasPermission('support', 'products:delete')).toBe(false)
    expect(roleHasPermission('support', 'orders:export')).toBe(false)

    expect(roleHasPermission('catalog', 'products:write')).toBe(true)
    expect(roleHasPermission('catalog', 'customers:pii')).toBe(false)
    expect(roleHasPermission('catalog', 'products:delete')).toBe(true)

    expect(roleHasPermission('viewer', 'orders:read')).toBe(true)
    expect(roleHasPermission('viewer', 'orders:write')).toBe(false)
    expect(permissionsForRole('owner')).toContain('staff:write')
  })

  it('accepts known roles only', () => {
    expect(isAdminRole('owner')).toBe(true)
    expect(isAdminRole('admin')).toBe(false)
    expect(isAdminRole('support')).toBe(true)
  })

  it('filters nav by permission', () => {
    expect(navPermissionForHref('/admin/dashboard/users')).toBe('customers:pii')
    expect(navPermissionForHref('/admin/dashboard/coupons')).toBe('coupons:write')
    expect(navPermissionForHref('/admin/dashboard')).toBe('dashboard:read')
  })

  it('redacts customer PII when the role cannot see it', () => {
    const order = {
      id: 'o1',
      customerEmail: 'a@b.hu',
      customerName: 'Teszt',
      customerPhone: '0630',
      shippingCity: 'Budapest',
      totalHuf: 1000,
    }
    expect(redactCustomerPii(order, true).customerEmail).toBe('a@b.hu')
    const redacted = redactCustomerPii(order, false)
    expect(redacted.customerEmail).toBeNull()
    expect(redacted.customerName).toBeNull()
    expect(redacted.shippingCity).toBeNull()
    expect(redacted.totalHuf).toBe(1000)
  })

  it('validates operator username and password', () => {
    expect(parseAdminUsername('Ann')).toBe('ann')
    expect(parseAdminUsername('x')).toBeNull()
    expect(parseAdminUsername('Bad Name')).toBeNull()
    expect(parseAdminPassword('short')).toBeNull()
    expect(parseAdminPassword('longenough1')).toBe('longenough1')
  })

  it('keeps bootstrap actor as owner', () => {
    expect(BOOTSTRAP_ADMIN_ACTOR.role).toBe('owner')
    expect(BOOTSTRAP_ADMIN_ACTOR.bootstrap).toBe(true)
  })
})
