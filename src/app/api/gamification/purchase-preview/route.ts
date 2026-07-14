import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import { getPointBalance } from '@/lib/gamification/point-ledger'
import {
  maxPointsDiscountHuf,
  hufToPoints,
  pointsToHuf,
} from '@/lib/gamification/purchase-points'
import { MAX_CART_POINTS_COVERAGE, POINTS_PER_HUF } from '@/lib/gamification/constants'

/**
 * GET /api/gamification/purchase-preview?cartTotalHuf=50000
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

  const url = new URL(request.url)
  const cartTotalHuf = Number(url.searchParams.get('cartTotalHuf') ?? '0')
  if (!Number.isFinite(cartTotalHuf) || cartTotalHuf <= 0) {
    return NextResponse.json({ error: 'Invalid cartTotalHuf' }, { status: 400 })
  }

  const maxDiscountHuf = maxPointsDiscountHuf(cartTotalHuf)
  const balance = isDbConfigured() ? await getPointBalance(userId) : 0
  const maxByBalanceHuf = pointsToHuf(balance)
  const usableDiscountHuf = Math.min(maxDiscountHuf, maxByBalanceHuf, cartTotalHuf)

  return NextResponse.json({
    balance,
    cartTotalHuf,
    maxPointsDiscountHuf: maxDiscountHuf,
    maxUsablePointsDiscountHuf: usableDiscountHuf,
    maxUsablePoints: hufToPoints(usableDiscountHuf),
    pointsPerHuf: POINTS_PER_HUF,
    maxCoveragePercent: MAX_CART_POINTS_COVERAGE,
  })
}
