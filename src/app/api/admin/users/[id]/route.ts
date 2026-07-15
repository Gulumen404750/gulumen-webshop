import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/admin/users/[id]
 * Felhasználó részletei: pontegyenleg, utolsó 10 tranzakció, gamification kuponok.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: { select: { orders: true } },
      pointWallet: true,
      pointTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      gamificationCoupons: {
        where: { source: 'gamification' },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      ordersCount: user._count.orders,
    },
    wallet: user.pointWallet
      ? {
          balance: user.pointWallet.balance,
          lifetimeEarned: user.pointWallet.lifetimeEarned,
          lifetimeRedeemed: user.pointWallet.lifetimeRedeemed,
          suspended: user.pointWallet.gamificationSuspended,
        }
      : null,
    transactions: user.pointTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      delta: tx.delta,
      balanceAfter: tx.balanceAfter,
      reason: tx.reason,
      createdAt: tx.createdAt.toISOString(),
    })),
    coupons: user.gamificationCoupons.map((c) => ({
      id: c.id,
      code: c.code,
      active: c.active,
      discountType: c.discountType,
      discountValue: c.discountValue,
      validUntil: c.validUntil?.toISOString() ?? null,
      usedCount: c.usedCount,
      maxUses: c.maxUses,
      createdAt: c.createdAt.toISOString(),
    })),
  })
}
