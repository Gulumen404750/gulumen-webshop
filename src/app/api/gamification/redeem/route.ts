import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import {
  redeemPointsForCoupon,
  RedeemThresholdNotMetError,
} from '@/lib/gamification/redeem-coupon'
import {
  GamificationSuspendedError,
  InsufficientPointsError,
} from '@/lib/gamification/point-ledger'
import { REDEEM_THRESHOLD_MIN } from '@/lib/gamification/constants'

/**
 * POST /api/gamification/redeem
 * Pont beváltás kuponra (>= 350 pont, tranzakcióban).
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request)
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

  try {
    const result = await redeemPointsForCoupon(userId, REDEEM_THRESHOLD_MIN)

    return NextResponse.json({
      ok: true,
      couponCode: result.coupon.code,
      discountPercent: result.coupon.discountValue,
      validUntil: result.coupon.validUntil?.toISOString() ?? null,
      pointsSpent: result.pointsSpent,
      balanceAfter: result.balanceAfter,
    })
  } catch (e) {
    if (e instanceof RedeemThresholdNotMetError || e instanceof InsufficientPointsError) {
      return NextResponse.json(
        { error: 'insufficient_points', message: e.message, threshold: REDEEM_THRESHOLD_MIN },
        { status: 400 }
      )
    }
    if (e instanceof GamificationSuspendedError) {
      return NextResponse.json({ error: 'suspended', message: e.message }, { status: 403 })
    }
    console.error('[api/gamification/redeem] POST', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
