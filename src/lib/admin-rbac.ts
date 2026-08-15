/**
 * Admin RBAC – least privilege.
 * Belső szerepek: viewer | catalog | support | owner.
 * A staff UI / API csak operátori szerepeket adhat (OPERATOR_ROLES) —
 * `owner` kizárólag a gyári ADMIN_API_KEY + 2FA bootstrap session.
 */

export const ADMIN_ROLES = ['viewer', 'catalog', 'support', 'owner'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

/**
 * Másodlagos operátoroknak adható szerepek a felületről.
 * Owner / főadmin SOHA nem szerepelhet itt.
 */
export const OPERATOR_ROLES = ['viewer', 'catalog', 'support'] as const
export type OperatorRole = (typeof OPERATOR_ROLES)[number]

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
    'products:delete',
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

/** Staff UI / create-update: csak operátori szerep (nem owner). */
export function isOperatorRole(value: unknown): value is OperatorRole {
  return typeof value === 'string' && (OPERATOR_ROLES as readonly string[]).includes(value)
}

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsForRole(role: AdminRole): AdminPermission[] {
  return [...ROLE_PERMISSIONS[role]]
}

/** Emberi olvasható címkék a staff UI tételes listájához. */
export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  'dashboard:read': 'Dashboard megtekintése',
  'products:read': 'Termékek megtekintése',
  'products:write': 'Termékek létrehozása / szerkesztése (ár, készlet)',
  'products:delete': 'Termékek törlése',
  'uploads:write': 'Képfeltöltés',
  'orders:read': 'Rendelések megtekintése',
  'orders:write': 'Rendelés státusz módosítása',
  'orders:export': 'Rendelés-export (CSV, PII)',
  'customers:pii': 'Vásárlói személyes adatok (név, cím, e-mail, telefon)',
  'support:write': 'Ügyfélszolgálat / elhagyott kosár / hívások',
  'coupons:write': 'Kuponok kezelése',
  'users:write': 'Felhasználók kezelése / törlése',
  'sourcing:capture': 'Sourcing automata (gép–gép)',
  'settings:write': 'Rendszerbeállítások',
  'staff:write': 'Operátorok / RBAC kezelése (csak főadmin)',
}

/** Korlátozások szerepkörönként – a staff UI-ban a „mit NEM érhet el” lista. */
export const ADMIN_ROLE_LIMITATIONS: Record<AdminRole, readonly string[]> = {
  viewer: [
    'Nem módosíthat és nem törölhet adatot.',
    'Nem lát vásárlói személyes adatokat (PII).',
    'Nem kezelhet operátorokat vagy beállításokat.',
    'Tömeges művelet (>10) tilos / jóváhagyásköteles — nincs írási jog.',
  ],
  catalog: [
    'Nem lát vásárlói személyes adatokat (PII).',
    'Nem módosíthat rendelést, kuponokat vagy felhasználókat.',
    'Nem érheti el a beállításokat és az operátor-kezelést.',
    'Több mint 10 termék törlése / tömeges ármódosítás: PENDING, főadmin jóváhagyás 5 percen belül.',
  ],
  support: [
    'Nem módosíthat / törölhet termékeket és árakat.',
    'Nem exportálhat rendelés-CSV-t.',
    'Nem kezelhet kuponokat, beállításokat vagy operátorokat.',
    'Tömeges törlés / módosítás (>10): PENDING, főadmin jóváhagyás 5 percen belül.',
  ],
  owner: [
    'Nem adható ki operátornak — csak a gyári ADMIN_API_KEY + 2FA főadmin útvonal.',
    'A staff felületen owner szerep nem választható és nem hozható létre.',
  ],
}

export type RolePermissionCatalogEntry = {
  permission: AdminPermission
  label: string
  granted: boolean
}

/** Tételes lista: minden ismert permission granted/denied a szerephez. */
export function rolePermissionCatalog(role: AdminRole): RolePermissionCatalogEntry[] {
  const granted = new Set(permissionsForRole(role))
  return ADMIN_PERMISSIONS.map((permission) => ({
    permission,
    label: ADMIN_PERMISSION_LABELS[permission],
    granted: granted.has(permission),
  }))
}

export function describeRoleAccess(role: AdminRole): {
  role: AdminRole
  permissions: RolePermissionCatalogEntry[]
  limitations: string[]
} {
  return {
    role,
    permissions: rolePermissionCatalog(role),
    limitations: [...ADMIN_ROLE_LIMITATIONS[role]],
  }
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
  'originalShippingPostalCode',
  'originalShippingCity',
  'originalShippingStreet',
  'originalShippingHouseNumber',
  'originalCustomerName',
  'originalCustomerPhone',
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
