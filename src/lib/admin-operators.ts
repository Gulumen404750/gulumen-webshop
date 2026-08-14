/**
 * Név szerinti admin operátorok (RBAC).
 * Amíg a tábla üres / nem létezik, countAdminOperators() 0 → API-kulcsos fallback.
 */
import bcrypt from 'bcryptjs'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  type AdminActor,
  type AdminRole,
  BOOTSTRAP_ADMIN_ACTOR,
  isAdminRole,
  parseAdminPassword,
  parseAdminUsername,
} from '@/lib/admin-rbac'

const BCRYPT_ROUNDS = 12

function toActor(row: { id: string; username: string; role: string }): AdminActor | null {
  if (!isAdminRole(row.role)) return null
  return { id: row.id, username: row.username, role: row.role }
}

/** Fail-open 0: hiányzó tábla / DB hiba ne zárja ki az egykulcsos belépést. */
export async function countAdminOperators(): Promise<number> {
  if (!isDbConfigured()) return 0
  try {
    return await prisma.adminOperator.count()
  } catch (err) {
    logger.warn({ err }, 'AdminOperator count failed; treating as empty (API-key fallback)')
    return 0
  }
}

export async function countActiveOwners(): Promise<number> {
  if (!isDbConfigured()) return 0
  try {
    return await prisma.adminOperator.count({
      where: { role: 'owner', active: true },
    })
  } catch (err) {
    logger.warn({ err }, 'AdminOperator owner count failed')
    return 0
  }
}

export async function getAdminOperatorById(id: string): Promise<AdminActor | null> {
  if (!isDbConfigured() || !id || id === 'admin' || id === 'api-key') return null
  try {
    const row = await prisma.adminOperator.findUnique({ where: { id } })
    if (!row || !row.active) return null
    return toActor(row)
  } catch (err) {
    logger.warn({ err, id }, 'AdminOperator lookup failed')
    return null
  }
}

export async function listAdminOperators(): Promise<
  { id: string; username: string; role: AdminRole; active: boolean; createdAt: string; updatedAt: string }[]
> {
  const rows = await prisma.adminOperator.findMany({
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
  })
  return rows
    .filter((row) => isAdminRole(row.role))
    .map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role as AdminRole,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
}

async function verifyOperatorPassword(username: string, password: string): Promise<AdminActor | null> {
  const row = await prisma.adminOperator.findUnique({ where: { username } })
  if (!row || !row.active) return null
  const ok = await bcrypt.compare(password, row.passwordHash)
  if (!ok) return null
  return toActor(row)
}

async function createFirstOwner(username: string, password: string): Promise<AdminActor | null> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  try {
    const row = await prisma.adminOperator.create({
      data: { username, passwordHash, role: 'owner', active: true },
    })
    return toActor(row)
  } catch (err) {
    logger.warn({ err, username }, 'first owner create failed; trying authenticate')
    return verifyOperatorPassword(username, password)
  }
}

export type ResolveLoginResult =
  | { ok: true; actor: AdminActor }
  | { ok: false; code: 'requiresOperator' | 'invalid_credentials' | 'invalid_input' }

/**
 * API-kulcs után: ha nincs operátor, bootstrap owner (kulcs-only).
 * Ha van operátor, kötelező a felhasználónév + jelszó.
 * Üres táblánál username+jelszó → első owner létrehozása.
 */
export async function resolveAdminLoginActor(input: {
  username?: unknown
  password?: unknown
}): Promise<ResolveLoginResult> {
  const count = await countAdminOperators()
  const rawUser = typeof input.username === 'string' ? input.username : ''
  const rawPass = typeof input.password === 'string' ? input.password : ''
  const hasOperatorFields = Boolean(rawUser.trim() || rawPass)

  if (count === 0) {
    if (!hasOperatorFields) {
      return { ok: true, actor: BOOTSTRAP_ADMIN_ACTOR }
    }
    const username = parseAdminUsername(rawUser)
    const password = parseAdminPassword(rawPass)
    if (!username || !password) {
      return { ok: false, code: 'invalid_input' }
    }
    const actor = await createFirstOwner(username, password)
    if (!actor) return { ok: false, code: 'invalid_credentials' }
    return { ok: true, actor }
  }

  if (!hasOperatorFields) {
    return { ok: false, code: 'requiresOperator' }
  }
  const username = parseAdminUsername(rawUser)
  if (!username || !rawPass) {
    return { ok: false, code: 'invalid_credentials' }
  }
  try {
    const actor = await verifyOperatorPassword(username, rawPass)
    if (!actor) return { ok: false, code: 'invalid_credentials' }
    return { ok: true, actor }
  } catch (err) {
    logger.error({ err }, 'operator password verify failed')
    return { ok: false, code: 'invalid_credentials' }
  }
}

export async function createAdminOperator(input: {
  username: string
  password: string
  role: AdminRole
}): Promise<AdminActor> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  const row = await prisma.adminOperator.create({
    data: {
      username: input.username,
      passwordHash,
      role: input.role,
      active: true,
    },
  })
  const actor = toActor(row)
  if (!actor) throw new Error('invalid role on create')
  return actor
}

export async function updateAdminOperator(
  id: string,
  patch: { role?: AdminRole; active?: boolean; password?: string }
): Promise<AdminActor | null> {
  const existing = await prisma.adminOperator.findUnique({ where: { id } })
  if (!existing) return null

  const nextRole = patch.role ?? (isAdminRole(existing.role) ? existing.role : null)
  const nextActive = patch.active ?? existing.active
  if (existing.role === 'owner' && existing.active) {
    const owners = await countActiveOwners()
    const demoting = nextRole !== 'owner' || nextActive === false
    if (demoting && owners <= 1) {
      const err = new Error('LAST_OWNER')
      err.name = 'LAST_OWNER'
      throw err
    }
  }

  const data: { role?: string; active?: boolean; passwordHash?: string } = {}
  if (patch.role) data.role = patch.role
  if (patch.active !== undefined) data.active = patch.active
  if (patch.password) data.passwordHash = await bcrypt.hash(patch.password, BCRYPT_ROUNDS)

  const row = await prisma.adminOperator.update({ where: { id }, data })
  return toActor(row)
}

export async function deleteAdminOperator(id: string): Promise<'ok' | 'not_found' | 'last_owner'> {
  const existing = await prisma.adminOperator.findUnique({ where: { id } })
  if (!existing) return 'not_found'
  if (existing.role === 'owner' && existing.active) {
    const owners = await countActiveOwners()
    if (owners <= 1) return 'last_owner'
  }
  await prisma.adminOperator.delete({ where: { id } })
  return 'ok'
}
