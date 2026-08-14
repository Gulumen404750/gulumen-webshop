import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/admin-auth'
import { permissionsForRole } from '@/lib/admin-rbac'
import { countActiveOwners, countAdminOperators } from '@/lib/admin-operators'
import {
  ADMIN_PARKED_COOKIE_NAME,
} from '@/lib/admin-session-park'
import { parseAdminSessionToken } from '@/lib/admin-session'

/**
 * GET /api/admin/me
 * Bejelentkezett operátor (vagy bootstrap owner, amíg nincs aktív owner).
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
  const hasParkedOwnerSession = Boolean(
    parkedActor && (parkedActor.role === 'owner' || parkedActor.bootstrap)
  )

  return NextResponse.json({
    id: actor.id,
    username: actor.username,
    role: actor.role,
    bootstrap: Boolean(actor.bootstrap),
    permissions: permissionsForRole(actor.role),
    operatorCount,
    ownerCount,
    /** Új belépéshez kell-e név szerinti operátor (van legalább egy aktív owner). */
    operatorsRequired: ownerCount > 0,
    hasParkedOwnerSession,
    parkedUsername: hasParkedOwnerSession ? parkedActor?.username ?? null : null,
  })
}
