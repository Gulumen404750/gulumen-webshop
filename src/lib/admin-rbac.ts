/**
 * Admin RBAC – least privilege.
 * Szerepek: viewer (olvasás, PII nélkül) | catalog (termék) | ops (rendelés + PII) | owner (minden).
 */

export const ADMIN_ROLES = ['viewer', 'catalog', 'ops', 'owner'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ADMIN_PERMISSIONS = [
  'dashboard:read',
  'products:read',
  'products:write',
  'uploads:write',
  'orders:read',
  'orders:write',
  'customers:pii',
  'support:write',
  'coupons:write',
  'sourcing:capture',
  'settings:write',
  'staff:write',
] as const
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

export type AdminActor = {
  id: string
  username: string
  role: AdminRole
}

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  viewer: ['dashboard:read', 'products:read', 'orders:read'],
  catalog: ['dashboard:read', 'products:read', 'products:write', 'uploads:write', 'orders:read'],
  ops: [
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

export function parseAdminUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const username = raw.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return null
  return username
}

export const ADMIN_PASSWORD_MIN_LENGTH = 10

export function parseAdminPassword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length < ADMIN_PASSWORD_MIN_LENGTH || raw.length > 200) return null
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
