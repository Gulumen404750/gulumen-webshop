import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { ageFromBirthDate, formatBirthDateForInput } from '@/lib/birthday-coupon'
import { logAdminAction } from '@/lib/admin-audit'

/**
 * GET /api/admin/users/[id]
 * Felhasználó részletei: pontegyenleg, utolsó 10 tranzakció, gamification kuponok.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermission('customers:pii')
  if (!auth.ok) return auth.response
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
      birthDate: formatBirthDateForInput(user.birthDate) || null,
      age: user.birthDate ? ageFromBirthDate(user.birthDate) : null,
      marketingOptIn: user.marketingOptIn,
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

/**
 * DELETE /api/admin/users/[id]
 * Felhasználó + kapcsolódó tesztadatok törlése (újra regisztrálható legyen ugyanazzal az e-maillel).
 * Lezárt / meglévő rendelések megmaradnak (userId → null).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermission('customers:pii')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, _count: { select: { orders: true } } },
  })
  if (!user) {
    await logAdminAction({
      action: 'user_delete',
      success: false,
      request,
      details: { id, reason: 'not_found' },
    })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Rendelések megőrzése – csak a user kapcsolat leválasztása
      await tx.order.updateMany({
        where: { userId: id },
        data: { userId: null },
      })
      // Személyes kuponok inaktiválása (forráskódok megmaradhatnak auditnak, user leválik SetNull-lal)
      await tx.coupon.updateMany({
        where: { userId: id },
        data: { active: false, userId: null },
      })
      // MarketingConsent az e-mailhez – töröljük, hogy tiszta újra-regisztráció / checkout teszt legyen
      await tx.marketingConsent.deleteMany({
        where: { email: user.email },
      })
      // PointSnapshot nincs FK-reláció – kézzel töröljük
      await tx.pointSnapshot.deleteMany({ where: { userId: id } })
      await tx.user.delete({ where: { id } })
    })

    await logAdminAction({
      action: 'user_delete',
      success: true,
      request,
      details: { id, email: user.email, ordersDetached: user._count.orders },
    })
    return NextResponse.json({
      ok: true,
      deletedUserId: id,
      email: user.email,
      ordersDetached: user._count.orders,
    })
  } catch (e) {
    console.error('[api/admin/users/[id]] DELETE', e)
    await logAdminAction({
      action: 'user_delete',
      success: false,
      request,
      details: { id, reason: 'error' },
    })
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Törlés sikertelen' },
      { status: 500 }
    )
  }
}
