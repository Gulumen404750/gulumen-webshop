/**
 * Név szerinti admin operátorok (username + jelszó, RBAC szerep).
 */

import bcrypt from 'bcryptjs'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  type AdminActor,
  type AdminRole,
  isAdminRole,
  parseAdminPassword,
  parseAdminUsername,
} from '@/lib/admin-rbac'

const BCRYPT_COST = 12

export function toAdminActor(row: { id: string; username: string; role: string }): AdminActor | null {
  if (!isAdminRole(row.role)) return null
  return { id: row.id, username: row.username, role: row.role }
}

export async function findActiveOperatorById(id: string): Promise<AdminActor | null> {
  if (!isDbConfigured()) return null
  const row = await prisma.adminOperator.findUnique({
    where: { id },
    select: { id: true, username: true, role: true, active: true },
  })
  if (!row?.active) return null
  return toAdminActor(row)
}

export async function authenticateAdminOperator(
  usernameRaw: unknown,
  passwordRaw: unknown
): Promise<{ ok: true; actor: AdminActor; created: boolean } | { ok: false; reason: 'invalid' | 'inactive' | 'no_db' }> {
  if (!isDbConfigured()) return { ok: false, reason: 'no_db' }
  const username = parseAdminUsername(usernameRaw)
  const password = parseAdminPassword(passwordRaw)
  if (!username || !password) return { ok: false, reason: 'invalid' }

  return prisma.$transaction(async (tx) => {
    const count = await tx.adminOperator.count()
    if (count === 0) {
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
      const row = await tx.adminOperator.create({
        data: { username, passwordHash, role: 'owner', active: true },
        select: { id: true, username: true, role: true },
      })
      const actor = toAdminActor(row)
      if (!actor) return { ok: false as const, reason: 'invalid' as const }
      return { ok: true as const, actor, created: true }
    }

    const row = await tx.adminOperator.findUnique({
      where: { username },
      select: { id: true, username: true, role: true, active: true, passwordHash: true },
    })
    if (!row) return { ok: false as const, reason: 'invalid' as const }
    const match = await bcrypt.compare(password, row.passwordHash)
    if (!match) return { ok: false as const, reason: 'invalid' as const }
    if (!row.active) return { ok: false as const, reason: 'inactive' as const }
    const actor = toAdminActor(row)
    if (!actor) return { ok: false as const, reason: 'invalid' as const }
    return { ok: true as const, actor, created: false }
  })
}

export async function listAdminOperators(): Promise<
  Array<{ id: string; username: string; role: AdminRole; active: boolean; createdAt: string }>
> {
  const rows = await prisma.adminOperator.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, role: true, active: true, createdAt: true },
  })
  return rows.flatMap((row) => {
    const actor = toAdminActor(row)
    if (!actor) return []
    return [
      {
        id: actor.id,
        username: actor.username,
        role: actor.role,
        active: row.active,
        createdAt: row.createdAt.toISOString(),
      },
    ]
  })
}

export async function createAdminOperator(params: {
  username: string
  password: string
  role: AdminRole
}): Promise<AdminActor> {
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_COST)
  const row = await prisma.adminOperator.create({
    data: {
      username: params.username,
      passwordHash,
      role: params.role,
      active: true,
    },
    select: { id: true, username: true, role: true },
  })
  const actor = toAdminActor(row)
  if (!actor) throw new Error('invalid operator role')
  return actor
}

export async function updateAdminOperator(
  id: string,
  data: { role?: AdminRole; active?: boolean; password?: string }
): Promise<AdminActor | null> {
  const passwordHash = data.password ? await bcrypt.hash(data.password, BCRYPT_COST) : undefined
  const row = await prisma.adminOperator.update({
    where: { id },
    data: {
      ...(data.role ? { role: data.role } : {}),
      ...(typeof data.active === 'boolean' ? { active: data.active } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: { id: true, username: true, role: true, active: true },
  })
  if (!row.active) return toAdminActor(row)
  return toAdminActor(row)
}

export async function countActiveOwners(exceptId?: string): Promise<number> {
  return prisma.adminOperator.count({
    where: {
      role: 'owner',
      active: true,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  })
}
