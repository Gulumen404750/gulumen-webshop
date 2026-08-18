/**
 * Pont beváltás kuponra – egyetlen Prisma $transaction: levonás + Coupon.
 */
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  COUPON_VALIDITY_DAYS,
  REDEEM_COUPON_PERCENT,
  REDEEM_THRESHOLD_DEFAULT,
  POINT_TX_TYPES,
} from './constants'
import { GamificationSuspendedError, InsufficientPointsError } from './point-ledger'

export class RedeemThresholdNotMetError extends Error {
  constructor(threshold: number) {
    super(`Minimum ${threshold} points required`)
    this.name = 'RedeemThresholdNotMetError'
  }
}

export async function redeemPointsForCoupon(
  userId: string,
  threshold = REDEEM_THRESHOLD_DEFAULT
) {
  const couponCode = `GLM-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + COUPON_VALIDITY_DAYS)

  return prisma.$transaction(async (tx) => {
    await tx.userPointWallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    })

    const wallet = await tx.userPointWallet.findUniqueOrThrow({ where: { userId } })
    if (wallet.gamificationSuspended) throw new GamificationSuspendedError()
    if (wallet.balance < threshold) throw new RedeemThresholdNotMetError(threshold)

    const newBalance = wallet.balance - threshold
    const updated = await tx.userPointWallet.updateMany({
      where: { userId, version: wallet.version },
      data: {
        balance: newBalance,
        version: { increment: 1 },
        lifetimeRedeemed: { increment: threshold },
      },
    })
    if (updated.count === 0) throw new Error('CONCURRENT_WALLET_UPDATE')

    const idempotencyKey = `redeem:${userId}:${threshold}:${wallet.version}`
    const transaction = await tx.pointTransaction.create({
      data: {
        userId,
        delta: -threshold,
        balanceAfter: newBalance,
        type: POINT_TX_TYPES.REDEEM_COUPON,
        reason: `${threshold} pont beváltva kuponra`,
        idempotencyKey,
        referenceType: 'coupon',
        referenceId: couponCode,
      },
    })

    const coupon = await tx.coupon.create({
      data: {
        code: couponCode,
        discountType: 'percent',
        discountValue: REDEEM_COUPON_PERCENT,
        active: true,
        validFrom: new Date(),
        validUntil,
        maxUses: 1,
        userId,
        source: 'gamification',
        pointTransactionId: transaction.id,
      },
    })

    return { coupon, transaction, pointsSpent: threshold, balanceAfter: newBalance }
  })
}

/** Kupon nem lett felhasználva – pont visszatérítés (REVERSAL). */
export async function reverseCouponRedemptionIfUnused(
  userId: string,
  couponId: string,
  pointsToRestore: number
) {
  return prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findFirst({
      where: { id: couponId, userId, source: 'gamification', usedCount: 0, active: true },
    })
    if (!coupon) return null

    await tx.coupon.update({ where: { id: couponId }, data: { active: false } })

    const wallet = await tx.userPointWallet.findUniqueOrThrow({ where: { userId } })
    const newBalance = wallet.balance + pointsToRestore
    await tx.userPointWallet.update({
      where: { userId },
      data: {
        balance: newBalance,
        version: { increment: 1 },
        lifetimeRedeemed: { decrement: pointsToRestore },
      },
    })

    const reversal = await tx.pointTransaction.create({
      data: {
        userId,
        delta: pointsToRestore,
        balanceAfter: newBalance,
        type: POINT_TX_TYPES.REVERSAL,
        idempotencyKey: `reversal:coupon:${couponId}`,
        reason: 'Kupon érvénytelenítve – pont visszatérítés',
        referenceType: 'coupon',
        referenceId: couponId,
      },
    })

    return reversal
  })
}
