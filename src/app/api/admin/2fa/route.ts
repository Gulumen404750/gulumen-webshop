import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { getAdminTwoFactorState } from '@/lib/admin-2fa'

/**
 * GET /api/admin/2fa
 * 2FA állapot az admin beállítások UI-hoz. A secret soha nem megy ki.
 */
export async function GET() {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const state = await getAdminTwoFactorState()
  return NextResponse.json({
    isTwoFactorEnabled: state.isTwoFactorEnabled,
    hasSecret: Boolean(state.totpSecret),
  })
}
