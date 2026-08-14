import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { getAdminTwoFactorState } from '@/lib/admin-2fa'

/**
 * GET /api/admin/2fa
 * 2FA állapot az admin beállítások UI-hoz. A secret soha nem megy ki.
 */
export async function GET() {
  const auth = await requireAdminPermission('settings:write')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const state = await getAdminTwoFactorState()
  return NextResponse.json({
    isTwoFactorEnabled: state.isTwoFactorEnabled,
    hasSecret: Boolean(state.totpSecret),
  })
}
