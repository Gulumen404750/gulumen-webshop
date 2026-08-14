import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/admin-auth'
import { permissionsForRole } from '@/lib/admin-rbac'
import { countActiveOwners, countAdminOperators } from '@/lib/admin-operators'
import {
  ADMIN_PARKED_COOKIE_NAME,
} from '@/lib/admin-session-park'
import {
  ADMIN_COOKIE_NAME,
  OPERATOR_COOKIE_NAME,
  parseAdminSessionToken,
} from '@/lib/admin-session'

/**
 * GET /api/admin/me
 * Bejelentkezett operátor (vagy bootstrap / owner).
 * Ha operátor süti aktív és owner süti is megvan → hasParkedOwnerSession (izoláció).
 */
export async function GET() {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [operatorCount, ownerCount] = await Promise.all([
    countAdminOperators(),
    countActiveOwners(),
  ])
  const cookieStore = await cookies()
  const parkedRaw = cookieStore.get(ADMIN_PARKED_COOKIE_NAME)?.value
  const parkedActor = parkedRaw ? await parseAdminSessionToken(parkedRaw) : null

  const ownerCookie = await parseAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)
  const operatorCookie = await parseAdminSessionToken(
    cookieStore.get(OPERATOR_COOKIE_NAME)?.value
  )
  const dormantOwner =
    operatorCookie &&
    ownerCookie &&
    (ownerCookie.bootstrap || ownerCookie.role === 'owner') &&
    actor.id !== ownerCookie.id
      ? ownerCookie
      : null

  const hasParkedOwnerSession = Boolean(
    (parkedActor && (parkedActor.role === 'owner' || parkedActor.bootstrap)) || dormantOwner
  )
  const parkedUsername = dormantOwner
    ? dormantOwner.username
    : hasParkedOwnerSession
      ? parkedActor?.username ?? null
      : null

  return NextResponse.json({
    id: actor.id,
    username: actor.username,
    role: actor.role,
    bootstrap: Boolean(actor.bootstrap),
    permissions: permissionsForRole(actor.role),
    operatorCount,
    ownerCount,
    /** Legacy jelzés; owner belépés (/admin/login) mindig elérhető. */
    operatorsRequired: false,
    hasParkedOwnerSession,
    parkedUsername,
    scope: actor.bootstrap || actor.role === 'owner' ? 'owner' : 'operator',
  })
}
