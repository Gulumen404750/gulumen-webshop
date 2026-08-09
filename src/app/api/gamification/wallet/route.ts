import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { REDEEM_THRESHOLD_MIN } from '@/lib/gamification/constants'
import { processPendingPointEvents } from '@/lib/gamification/point-event-queue'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

/**
 * GET /api/gamification/wallet
 * UserPointWallet egyenleg + beváltási állapot.
 */
export async function GET(request: Request) {
  const limit = rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429, headers: NO_STORE_HEADERS }
    )
  }

  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })
  }

  if (!isDbConfigured()) {
    const { devGetWallet } = await import('@/lib/dev-gamification')
    return NextResponse.json(devGetWallet(userId), { headers: NO_STORE_HEADERS })
  }

  try {
    await processPendingPointEvents(10, userId)

    const [wallet, activeCoupon] = await Promise.all([
      prisma.userPointWallet.findUnique({ where: { userId } }),
      prisma.coupon.findFirst({
        where: { userId, source: 'gamification', active: true },
        select: { code: true, validUntil: true },
      }),
    ])

    const balance = wallet?.balance ?? 0
    const canRedeem =
      balance >= REDEEM_THRESHOLD_MIN &&
      !wallet?.gamificationSuspended &&
      !activeCoupon

    return NextResponse.json(
      {
        balance,
        lifetimeEarned: wallet?.lifetimeEarned ?? 0,
        lifetimeRedeemed: wallet?.lifetimeRedeemed ?? 0,
        redeemThreshold: REDEEM_THRESHOLD_MIN,
        canRedeem,
        hasActiveCoupon: Boolean(activeCoupon),
        activeCouponCode: activeCoupon?.code ?? null,
        suspended: wallet?.gamificationSuspended ?? false,
        gamificationEnabled: true,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (e) {
    console.error('[api/gamification/wallet] GET', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
