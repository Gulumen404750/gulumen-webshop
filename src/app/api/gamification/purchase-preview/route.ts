import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import { getPointBalance } from '@/lib/gamification/point-ledger'
import { getAvailableGiftPoints, getSoonestGiftExpiry } from '@/lib/gamification/gift-points'
import {
  maxPointsDiscountHuf,
  hufToPoints,
  computeMixedPointsRedemption,
  splitWalletBalances,
} from '@/lib/gamification/purchase-points'
import {
  GIFT_POINTS_MAX_COVERAGE,
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
} from '@/lib/gamification/constants'

/**
 * GET /api/gamification/purchase-preview?cartTotalHuf=50000
 */
export async function GET(request: Request) {
  const limit = await rateLimit(request)
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

  const balance = isDbConfigured() ? await getPointBalance(userId) : 0
  const giftPointsAvailable = isDbConfigured() ? await getAvailableGiftPoints(userId) : 0
  const giftExpiresAt = isDbConfigured() ? await getSoonestGiftExpiry(userId) : null
  const { giftBalance, activityBalance } = splitWalletBalances(balance, giftPointsAvailable)

  const giftOnly = computeMixedPointsRedemption({
    merchandiseHuf: cartTotalHuf,
    requestedDiscountHuf: cartTotalHuf,
    userBalance: balance,
    giftPointsAvailable,
    spendGift: true,
    spendActivity: false,
  })
  const activityOnly = computeMixedPointsRedemption({
    merchandiseHuf: cartTotalHuf,
    requestedDiscountHuf: cartTotalHuf,
    userBalance: balance,
    giftPointsAvailable,
    spendGift: false,
    spendActivity: true,
  })
  const combined = computeMixedPointsRedemption({
    merchandiseHuf: cartTotalHuf,
    requestedDiscountHuf: cartTotalHuf,
    userBalance: balance,
    giftPointsAvailable,
  })
  const usableDiscountHuf = combined.pointsDiscountHuf
  const maxDiscountHuf = maxPointsDiscountHuf(cartTotalHuf)

  return NextResponse.json({
    balance,
    giftPointsAvailable: giftBalance,
    giftBalance,
    activityBalance,
    giftExpiresAt: giftExpiresAt?.toISOString() ?? null,
    cartTotalHuf,
    maxPointsDiscountHuf: maxDiscountHuf,
    maxUsablePointsDiscountHuf: usableDiscountHuf,
    maxUsablePoints: hufToPoints(usableDiscountHuf),
    maxGiftDiscountHuf: giftOnly.pointsDiscountHuf,
    maxGiftPoints: giftOnly.giftPointsUsed,
    maxActivityDiscountHuf: activityOnly.pointsDiscountHuf,
    maxActivityPoints: activityOnly.activityPointsUsed,
    giftPointsUsed: combined.giftPointsUsed,
    activityPointsUsed: combined.activityPointsUsed,
    invoiceMerchandiseHuf: Math.max(0, Math.floor(cartTotalHuf) - usableDiscountHuf),
    pointsPerHuf: POINTS_PER_HUF,
    giftCoveragePercent: GIFT_POINTS_MAX_COVERAGE,
    activityCoveragePercent: MAX_CART_POINTS_COVERAGE,
    maxCoveragePercent: giftBalance > 0 ? GIFT_POINTS_MAX_COVERAGE : MAX_CART_POINTS_COVERAGE,
  })
}
