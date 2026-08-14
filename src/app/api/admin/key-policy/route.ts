import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import { getAdminKeyPolicyStatus, setAdminMustChangeKey } from '@/lib/admin-key-policy'

/**
 * GET /api/admin/key-policy
 * mustChangeKey állapot a beállításokhoz. A nyers kulcs / teljes fingerprint nem megy ki.
 */
export async function GET() {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const status = await getAdminKeyPolicyStatus()
  return NextResponse.json({
    mustChangeKey: status.mustChangeKey,
    keyConfirmedAt: status.keyConfirmedAt,
    maxAgeDays: status.maxAgeDays,
    daysOld: status.daysOld,
    fingerprintPrefix: status.fingerprintPrefix,
  })
}

/**
 * POST /api/admin/key-policy
 * Body: { mustChangeKey: true } – a következő belépéshez új ADMIN_API_KEY kell.
 * A jelenlegi session megmarad, amíg a kulcsot ténylegesen nem cseréled (akkor a JWT ak/sv claim érvénytelen).
 */
export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  if (body?.mustChangeKey !== true) {
    return NextResponse.json({ error: 'mustChangeKey: true szükséges.' }, { status: 400 })
  }

  await setAdminMustChangeKey(true)
  await logAdminAction({
    action: 'must_change_key',
    success: true,
    request,
  })
  return NextResponse.json({ ok: true, mustChangeKey: true })
}
