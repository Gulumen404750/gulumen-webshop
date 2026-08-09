import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import {
  checkHeartbeatVelocity,
  getClientIp,
} from '@/lib/gamification/heartbeat-velocity'

/**
 * POST /api/gamification/heartbeat
 * Anti-abuse: IP rate-limit (max 3/perc) + user/IP velocity.
 * A kliensoldali isVisible/hasFocus flagek NEM megbízhatók – nem befolyásolják a döntést.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, 'heartbeat')
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', accepted: false, reason: 'rate_limit' },
      { status: 429 }
    )
  }

  const ip = getClientIp(request)
  const session = await getSession(request)
  const userId = session?.userId ?? `anon:${ip}`

  const velocity = await checkHeartbeatVelocity({ userId, ip })
  if (!velocity.ok) {
    return NextResponse.json(
      {
        accepted: false,
        reason: velocity.reason,
        retryAfterMs: velocity.retryAfterMs,
        error: 'Heartbeat velocity limit exceeded',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(velocity.retryAfterMs / 1000) || 1),
        },
      }
    )
  }

  // Body opcionális – flageket szándékosan figyelmen kívül hagyjuk (anti-abuse).
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      await request.json()
    } catch {
      // ignore invalid/empty body
    }
  }

  return NextResponse.json({
    ok: true,
    accepted: true,
    ts: Date.now(),
  })
}
