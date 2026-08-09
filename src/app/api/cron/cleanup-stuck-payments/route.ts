import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/prisma'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { cleanupStuckPayments } from '@/lib/stuck-payments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cron/cleanup-stuck-payments
 * Railway cron: elakadt payment_pending cancel + stock restore.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const result = await cleanupStuckPayments()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron/cleanup-stuck-payments]', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
