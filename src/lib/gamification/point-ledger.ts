/**
 * Append-only pont főkönyv + UserPointWallet cache.
 * Race condition: optimistic lock (version) + DB CHECK (balance >= 0) + idempotencyKey.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { WALLET_UPDATE_MAX_RETRIES, type PointTxType } from './constants'

export class InsufficientPointsError extends Error {
  constructor(message = 'Insufficient points') {
    super(message)
    this.name = 'InsufficientPointsError'
  }
}

export class GamificationSuspendedError extends Error {
  constructor(message = 'Gamification suspended') {
    super(message)
    this.name = 'GamificationSuspendedError'
  }
}

export type ApplyPointDeltaInput = {
  userId: string
  delta: number
  type: PointTxType
  idempotencyKey: string
  reason?: string
  referenceType?: string
  referenceId?: string
  metadata?: Record<string, unknown>
}

export async function ensurePointWallet(userId: string): Promise<void> {
  await prisma.userPointWallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  })
}

/** Idempotens: ha már létezik a kulcs, visszaadja a meglévő tranzakciót. */
export async function applyPointDelta(input: ApplyPointDeltaInput) {
  if (input.delta === 0) {
    throw new Error('Point delta must not be zero')
  }

  const existing = await prisma.pointTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (existing) {
    const wallet = await prisma.userPointWallet.findUnique({ where: { userId: input.userId } })
    return { transaction: existing, wallet, duplicate: true as const }
  }

  for (let attempt = 0; attempt < WALLET_UPDATE_MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.userPointWallet.upsert({
          where: { userId: input.userId },
          create: { userId: input.userId, balance: 0 },
          update: {},
        })

        const wallet = await tx.userPointWallet.findUniqueOrThrow({
          where: { userId: input.userId },
        })

        if (wallet.gamificationSuspended && input.delta > 0) {
          throw new GamificationSuspendedError()
        }

        const newBalance = wallet.balance + input.delta
        if (newBalance < 0) {
          throw new InsufficientPointsError()
        }

        const updated = await tx.userPointWallet.updateMany({
          where: { userId: input.userId, version: wallet.version },
          data: {
            balance: newBalance,
            version: { increment: 1 },
            lifetimeEarned: input.delta > 0 ? { increment: input.delta } : undefined,
            lifetimeRedeemed: input.delta < 0 ? { increment: Math.abs(input.delta) } : undefined,
          },
        })

        if (updated.count === 0) {
          throw new Error('CONCURRENT_WALLET_UPDATE')
        }

        const transaction = await tx.pointTransaction.create({
          data: {
            userId: input.userId,
            delta: input.delta,
            balanceAfter: newBalance,
            type: input.type,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            metadata: input.metadata as Prisma.InputJsonValue | undefined,
          },
        })

        const freshWallet = await tx.userPointWallet.findUniqueOrThrow({
          where: { userId: input.userId },
        })

        return { transaction, wallet: freshWallet, duplicate: false as const }
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const dup = await prisma.pointTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        })
        if (dup) {
          const wallet = await prisma.userPointWallet.findUnique({ where: { userId: input.userId } })
          return { transaction: dup, wallet, duplicate: true as const }
        }
      }
      if (e instanceof Error && e.message === 'CONCURRENT_WALLET_UPDATE') {
        continue
      }
      throw e
    }
  }

  throw new Error('Failed to apply point delta after retries')
}

export async function getPointBalance(userId: string): Promise<number> {
  const wallet = await prisma.userPointWallet.findUnique({ where: { userId } })
  return wallet?.balance ?? 0
}

/** Reconciliation: wallet.balance vs SUM(delta). */
export async function reconcileUserPoints(userId: string): Promise<{
  walletBalance: number
  ledgerSum: number
  match: boolean
}> {
  const [wallet, agg] = await Promise.all([
    prisma.userPointWallet.findUnique({ where: { userId } }),
    prisma.pointTransaction.aggregate({
      where: { userId },
      _sum: { delta: true },
    }),
  ])
  const walletBalance = wallet?.balance ?? 0
  const ledgerSum = agg._sum.delta ?? 0
  const match = walletBalance === ledgerSum

  if (wallet && !match) {
    await prisma.userPointWallet.update({
      where: { userId },
      data: { lastReconciledAt: new Date() },
    })
  }

  return { walletBalance, ledgerSum, match }
}
