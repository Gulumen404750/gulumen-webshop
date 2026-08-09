import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { recordBrowseHeartbeat } from '@/lib/gamification/browse-heartbeat'
import { processPendingPointEvents } from '@/lib/gamification/point-event-queue'
import {
  checkHeartbeatVelocity,
  getClientIp,
} from '@/lib/gamification/heartbeat-velocity'

/**
 * POST /api/gamification/heartbeat
 * Percenkénti tick – aktív böngészés logolása (UserDailyActivity).
 * Anti-abuse: IP + user velocity (max 3 tick/perc), kliens flagek nem megbízhatók.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, { preset: 'heartbeat' })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429 }
    )
  }

  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = getClientIp(request)
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

  let body: { isVisible?: boolean; hasFocus?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Soft hints only – server velocity / min-interval dönt.
  const isVisible = body.isVisible === true
  const hasFocus = body.hasFocus === true

  try {
    const result = await recordBrowseHeartbeat({ userId, isVisible, hasFocus })

    console.info('[gamification/heartbeat]', {
      userId,
      ip,
      accepted: result.accepted,
      activeSecondsToday: result.activeSecondsToday,
      bonusQueued: result.bonusQueued,
      reason: result.reason,
    })

    if (result.bonusQueued) {
      await processPendingPointEvents(5, userId)
    } else {
      await processPendingPointEvents(3, userId)
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[api/gamification/heartbeat] POST', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
