import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { permissionsForRole } from '@/lib/admin-rbac'
import { countAdminOperators } from '@/lib/admin-operators'

/**
 * GET /api/admin/me
 * Bejelentkezett operátor (vagy bootstrap owner, amíg a tábla üres).
 */
export async function GET() {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const operatorCount = await countAdminOperators()
  return NextResponse.json({
    id: actor.id,
    username: actor.username,
    role: actor.role,
    bootstrap: Boolean(actor.bootstrap),
    permissions: permissionsForRole(actor.role),
    operatorCount,
    operatorsRequired: operatorCount > 0,
  })
}
