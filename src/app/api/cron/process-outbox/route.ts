import { NextResponse } from 'next/server'
import { validateCronSecret } from '@/lib/cron-auth'
import { isDbConfigured } from '@/lib/prisma'
import { processOutbox } from '@/lib/outbox'

/**
 * GET /api/cron/process-outbox
 * Railway / külső cron: lejárt reservationök + PointEvent outbox.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const result = await processOutbox()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron/process-outbox] Error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
