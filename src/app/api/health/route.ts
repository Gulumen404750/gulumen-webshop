import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/health – liveness alias (Railway restart-loop elkerülés).
 * DB/Redis ellenőrzés: /api/health/ready
 */
export async function GET() {
  return NextResponse.json({ status: 'live', ts: Date.now() })
}
