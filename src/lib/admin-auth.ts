import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { parseAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-session'
import {
  type AdminActor,
  type AdminPermission,
  roleHasPermission,
} from '@/lib/admin-rbac'
import { findActiveOperatorById } from '@/lib/admin-operators'
import { isDbConfigured } from '@/lib/prisma'

export type { AdminActor, AdminPermission }

/** Bejelentkezett operátor (JWT + aktív DB rekord, ha van DB). */
export async function getAdminActor(): Promise<AdminActor | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const fromJwt = await parseAdminSessionToken(token)
  if (!fromJwt) return null
  if (!isDbConfigured()) return fromJwt
  return findActiveOperatorById(fromJwt.id)
}

/** Bármely bejelentkezett admin operátor. */
export async function requireAdmin(): Promise<AdminActor | null> {
  return getAdminActor()
}

export async function requireAdminPermission(
  permission: AdminPermission
): Promise<{ ok: true; actor: AdminActor } | { ok: false; response: NextResponse }> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!roleHasPermission(actor.role, permission)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, actor }
}

export function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY
}
