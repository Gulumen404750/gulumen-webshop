/**
 * Admin: pontból váltott (gamification) 10%-os kuponok listája.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import { REDEEM_COUPON_PERCENT } from './constants'

export type AdminGamificationCouponStatus = 'active' | 'used' | 'expired' | 'inactive'

export type AdminGamificationCouponRow = {
  id: string
  code: string
  discountPercent: number
  userId: string | null
  email: string | null
  name: string | null
  status: AdminGamificationCouponStatus
  usedCount: number
  maxUses: number | null
  pointsSpent: number | null
  createdAt: string
  validFrom: string | null
  validUntil: string | null
}

export function gamificationCouponAdminStatus(
  row: {
    active: boolean
    usedCount: number
    maxUses: number | null
    validUntil: Date | string | null
  },
  now: Date = new Date()
): AdminGamificationCouponStatus {
  const max = row.maxUses ?? 1
  if (row.usedCount >= max && max > 0) return 'used'
  const until = row.validUntil ? new Date(row.validUntil) : null
  if (until && !Number.isNaN(until.getTime()) && until.getTime() < now.getTime()) {
    return 'expired'
  }
  if (!row.active) return 'inactive'
  return 'active'
}

export function summarizeGamificationCouponStats(
  rows: Array<{ status: AdminGamificationCouponStatus }>
) {
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    used: rows.filter((r) => r.status === 'used').length,
    expired: rows.filter((r) => r.status === 'expired').length,
    inactive: rows.filter((r) => r.status === 'inactive').length,
  }
}

export async function listAdminGamificationCoupons(
  limit = 500
): Promise<AdminGamificationCouponRow[]> {
  if (!isDbConfigured()) return []

  const coupons = await prisma.coupon.findMany({
    where: { source: 'gamification' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { email: true, name: true } },
    },
  })

  const txIds = coupons
    .map((c) => c.pointTransactionId)
    .filter((id): id is string => Boolean(id))
  const txs =
    txIds.length > 0
      ? await prisma.pointTransaction.findMany({
          where: { id: { in: txIds } },
          select: { id: true, delta: true },
        })
      : []
  const pointsByTx = new Map(txs.map((tx) => [tx.id, Math.abs(tx.delta)]))

  return coupons.map((c) => {
    const percent =
      c.discountType === 'percent' && c.discountValue > 0
        ? c.discountValue > 1
          ? c.discountValue
          : Math.round(c.discountValue * 100)
        : REDEEM_COUPON_PERCENT
    return {
      id: c.id,
      code: c.code,
      discountPercent: percent,
      userId: c.userId,
      email: c.user?.email ?? null,
      name: c.user?.name ?? null,
      status: gamificationCouponAdminStatus(c),
      usedCount: c.usedCount,
      maxUses: c.maxUses,
      pointsSpent: c.pointTransactionId ? (pointsByTx.get(c.pointTransactionId) ?? null) : null,
      createdAt: c.createdAt.toISOString(),
      validFrom: c.validFrom?.toISOString() ?? null,
      validUntil: c.validUntil?.toISOString() ?? null,
    }
  })
}
