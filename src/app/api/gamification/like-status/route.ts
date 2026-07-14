import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getLikeGamificationStatus } from '@/lib/gamification/like-gamification'

/**
 * GET /api/gamification/like-status
 * 12 órás lájk ablak állapota (pontszerző limit).
 */
export async function GET(request: Request) {
  const limit = rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const status = await getLikeGamificationStatus(userId)
    return NextResponse.json(status ?? {
      qualifyingLikeCount: 0,
      qualifyingLikeTarget: 10,
      pointLimitReached: false,
      canEarnLikeProgress: true,
      windowResetsAt: null,
    })
  } catch (e) {
    console.error('[api/gamification/like-status]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
