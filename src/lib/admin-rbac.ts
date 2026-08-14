/**
 * Admin RBAC – least privilege.
 * Szerepek: viewer | catalog | support | owner.
 * Amíg nincs operátor a DB-ben, a JWT `sub=admin` bootstrap owner (API-kulcs fallback).
 */

export const ADMIN_ROLES = ['viewer', 'catalog', 'support', 'owner'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ADMIN_PERMISSIONS = [
  'dashboard:read',
  'products:read',
  'products:write',
  'products:delete',
  'uploads:write',
  'orders:read',
  'orders:write',
  'orders:export',
  'customers:pii',
  'support:write',
  'coupons:write',
  'users:write',
  'sourcing:capture',
  'settings:write',
  'staff:write',
] as const
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

export type AdminActor = {
  id: string
  username: string
  role: AdminRole
  bootstrap?: boolean
}

/** Egykulcsos fallback, amíg AdminOperator üres. */
export const BOOTSTRAP_ADMIN_ACTOR: AdminActor = {
  id: 'admin',
  username: 'admin',
  role: 'owner',
  bootstrap: true,
}

/** Sourcing automata: `x-admin-key` (gép–gép), owner jogosultság az auditban. */
export const API_KEY_MACHINE_ACTOR: AdminActor = {
  id: 'api-key',
  username: 'api-key',
  role: 'owner',
}

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  viewer: ['dashboard:read', 'products:read', 'orders:read'],
  catalog: [
    'dashboard:read',
    'products:read',
    'products:write',
    'uploads:write',
    'orders:read',
  ],
  support: [
    'dashboard:read',
    'products:read',
    'orders:read',
    'orders:write',
    'customers:pii',
    'support:write',
  ],
  owner: ADMIN_PERMISSIONS,
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value)
}

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsForRole(role: AdminRole): AdminPermission[] {
  return [...ROLE_PERMISSIONS[role]]
}

export function navPermissionForHref(href: string): AdminPermission | null {
  if (href.startsWith('/admin/dashboard/products')) return 'products:read'
  if (href.startsWith('/admin/dashboard/orders')) return 'orders:read'
  if (href.startsWith('/admin/dashboard/coupons')) return 'coupons:write'
  if (href.startsWith('/admin/dashboard/abandoned-carts')) return 'support:write'
  if (href.startsWith('/admin/dashboard/gamification')) return 'settings:write'
  if (href.startsWith('/admin/dashboard/users')) return 'customers:pii'
  if (href.startsWith('/admin/dashboard/chat')) return 'settings:write'
  if (href.startsWith('/admin/dashboard/calls')) return 'support:write'
  if (href.startsWith('/admin/dashboard/deal-popup')) return 'settings:write'
  if (href.startsWith('/admin/dashboard/settings')) return 'settings:write'
  return 'dashboard:read'
}

export function parseAdminUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const username = raw.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return null
  return username
}

export const ADMIN_OPERATOR_PASSWORD_MIN_LENGTH = 10

export function parseAdminPassword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length < ADMIN_OPERATOR_PASSWORD_MIN_LENGTH || raw.length > 200) return null
  return raw
}

const PII_ORDER_KEYS = [
  'customerEmail',
  'customerName',
  'customerPhone',
  'shippingPostalCode',
  'shippingCity',
  'shippingStreet',
  'shippingHouseNumber',
  'billingPostalCode',
  'billingCity',
  'billingStreet',
  'billingHouseNumber',
  'deliveryNotes',
] as const

export function redactCustomerPii<T extends Record<string, unknown>>(
  record: T,
  canSeePii: boolean
): T {
  if (canSeePii) return record
  const copy = { ...record }
  for (const key of PII_ORDER_KEYS) {
    if (key in copy) (copy as Record<string, unknown>)[key] = null
  }
  if ('email' in copy) (copy as Record<string, unknown>).email = null
  if ('name' in copy && 'email' in record) (copy as Record<string, unknown>).name = null
  if ('birthDate' in copy) (copy as Record<string, unknown>).birthDate = null
  if ('age' in copy) (copy as Record<string, unknown>).age = null
  return copy
}
