import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/admin/gamification
 * Gamification statisztikák, top 10 egyenleg, utolsó 50 PointTransaction.
 */
export async function GET() {
  const auth = await requireAdminPermission('coupons:write')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const [pointsAgg, activeCouponsCount, spinsCount, topWallets, transactions] =
      await Promise.all([
        prisma.pointTransaction.aggregate({
          where: { delta: { gt: 0 } },
          _sum: { delta: true },
        }),
        prisma.coupon.count({
          where: { source: 'gamification', active: true },
        }),
        prisma.luckySpin.count(),
        prisma.userPointWallet.findMany({
          orderBy: { balance: 'desc' },
          take: 10,
          include: {
            user: { select: { email: true, name: true } },
          },
        }),
        prisma.pointTransaction.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: { select: { email: true } },
          },
        }),
      ])

    return NextResponse.json({
      stats: {
        totalPointsDistributed: pointsAgg._sum.delta ?? 0,
        activeGamificationCoupons: activeCouponsCount,
        luckySpinsCount: spinsCount,
      },
      topUsers: topWallets.map((w) => ({
        userId: w.userId,
        email: w.user.email,
        name: w.user.name,
        balance: w.balance,
        lifetimeEarned: w.lifetimeEarned,
        lifetimeRedeemed: w.lifetimeRedeemed,
        suspended: w.gamificationSuspended,
      })),
      transactions: transactions.map((tx) => ({
        id: tx.id,
        userId: tx.userId,
        email: tx.user.email,
        type: tx.type,
        delta: tx.delta,
        balanceAfter: tx.balanceAfter,
        reason: tx.reason,
        createdAt: tx.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('[api/admin/gamification] GET', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
