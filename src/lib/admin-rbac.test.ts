import { describe, expect, it } from 'vitest'
import {
  isAdminRole,
  parseAdminPassword,
  parseAdminUsername,
  redactCustomerPii,
  roleHasPermission,
} from './admin-rbac'

describe('admin RBAC', () => {
  it('gives viewer no PII, catalog no capture, ops no coupons, owner everything', () => {
    expect(roleHasPermission('viewer', 'customers:pii')).toBe(false)
    expect(roleHasPermission('viewer', 'orders:read')).toBe(true)
    expect(roleHasPermission('catalog', 'products:write')).toBe(true)
    expect(roleHasPermission('catalog', 'sourcing:capture')).toBe(false)
    expect(roleHasPermission('ops', 'orders:write')).toBe(true)
    expect(roleHasPermission('ops', 'customers:pii')).toBe(true)
    expect(roleHasPermission('ops', 'coupons:write')).toBe(false)
    expect(roleHasPermission('owner', 'sourcing:capture')).toBe(true)
    expect(roleHasPermission('owner', 'staff:write')).toBe(true)
  })

  it('rejects unknown roles', () => {
    expect(isAdminRole('admin')).toBe(false)
    expect(isAdminRole('owner')).toBe(true)
  })

  it('validates username and password', () => {
    expect(parseAdminUsername('Alice')).toBe('alice')
    expect(parseAdminUsername('ab')).toBe(null)
    expect(parseAdminUsername('bad name')).toBe(null)
    expect(parseAdminPassword('short')).toBe(null)
    expect(parseAdminPassword('longenough1')).toBe('longenough1')
  })

  it('redacts customer PII when the role cannot see it', () => {
    const order = {
      id: 'o1',
      customerEmail: 'a@b.hu',
      customerPhone: '0630',
      totalHuf: 1000,
    }
    expect(redactCustomerPii(order, true).customerEmail).toBe('a@b.hu')
    expect(redactCustomerPii(order, false)).toEqual({
      id: 'o1',
      customerEmail: null,
      customerPhone: null,
      totalHuf: 1000,
    })
  })
})
