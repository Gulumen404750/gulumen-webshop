import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/gamification/heartbeat
 * Könnyű heartbeat végpont szigorú rate limittel (multi-instance Redis).
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, 'heartbeat')
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }
  return NextResponse.json({ ok: true, ts: Date.now() })
}
