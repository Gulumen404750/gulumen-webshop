import { NextResponse } from 'next/server'
import { isDbConfigured, prisma } from '@/lib/prisma'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { processPendingPointEvents } from '@/lib/gamification/point-event-queue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cron/process-outbox
 * Railway cron: lejárt reservationök + PointEvent outbox feldolgozás.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const now = new Date()
    const expired = await prisma.productReservation.updateMany({
      where: { status: 'RESERVED', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    })
    const processed = await processPendingPointEvents()
    return NextResponse.json({
      ok: true,
      expiredReservations: expired.count,
      pointEventsProcessed: processed,
    })
  } catch (e) {
    console.error('[cron/process-outbox]', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
