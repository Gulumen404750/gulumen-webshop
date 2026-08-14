import { NextResponse } from 'next/server'
import { getAdminActor } from '@/lib/admin-auth'
import { permissionsForRole } from '@/lib/admin-rbac'

/**
 * GET /api/admin/me
 * Bejelentkezett operátor + jogosultságok a navhoz.
 */
export async function GET() {
  const actor = await getAdminActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    id: actor.id,
    username: actor.username,
    role: actor.role,
    permissions: permissionsForRole(actor.role),
  })
}
