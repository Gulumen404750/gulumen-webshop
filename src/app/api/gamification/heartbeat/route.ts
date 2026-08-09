import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { recordBrowseHeartbeat } from '@/lib/gamification/browse-heartbeat'
import { processPendingPointEvents } from '@/lib/gamification/point-event-queue'

/**
 * POST /api/gamification/heartbeat
 * Percenkénti tick – aktív böngészés logolása (UserDailyActivity).
 * Body: { isVisible: boolean, hasFocus: boolean }
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

  let body: { isVisible?: boolean; hasFocus?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const isVisible = body.isVisible === true
  const hasFocus = body.hasFocus === true

  try {
    const result = await recordBrowseHeartbeat({ userId, isVisible, hasFocus })

    console.info('[gamification/heartbeat]', {
      userId,
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
