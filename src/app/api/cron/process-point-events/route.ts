import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/prisma'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { processPendingPointEvents } from '@/lib/gamification/point-event-queue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cron/process-point-events
 * Outbox worker: PointEvent → PointTransaction + UserPointWallet.
 * Csak CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const processed = await processPendingPointEvents()
    return NextResponse.json({ ok: true, processed })
  } catch (e) {
    console.error('[cron/process-point-events]', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

/** Publikus hívás – minden más HTTP metódus tiltva, worker nem indul. */
export async function POST() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function PATCH() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
