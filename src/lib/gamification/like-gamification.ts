/**
 * Race-safe like toggle + 12 órás pontszerző ablak (max 10 lájk / ablak).
 */
import { Prisma } from '@prisma/client'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { DAILY_LIKE_TARGET, LIKE_UNDO_DECREMENTS_DAILY_COUNT } from './constants'
import { enqueuePointEvent } from './point-event-queue'
import {
  ensureLikePointWindow,
  evaluateLikeWindow,
  getLikePointWindowStatus,
  likeWindowBonusIdempotencyKey,
  type LikePointWindowState,
} from './like-point-window'

export type LikeToggleResult = {
  liked: boolean
  likesCount: number
  qualifyingLikeCount: number
  qualifyingLikeTarget: number
  pointLimitReached: boolean
  canEarnLikeProgress: boolean
  windowResetsAt: string | null
  dailyBonusQueued: boolean
}

function toLikeMeta(window: LikePointWindowState): Pick<
  LikeToggleResult,
  'qualifyingLikeCount' | 'qualifyingLikeTarget' | 'pointLimitReached' | 'canEarnLikeProgress' | 'windowResetsAt'
> {
  return {
    qualifyingLikeCount: window.qualifyingLikeCount,
    qualifyingLikeTarget: window.qualifyingLikeTarget,
    pointLimitReached: window.pointLimitReached,
    canEarnLikeProgress: window.canEarnProgress,
    windowResetsAt: window.windowEndsAt.toISOString(),
  }
}

export async function toggleLikeWithGamification(
  productId: string,
  userId: string
): Promise<LikeToggleResult> {
  if (!isDbConfigured()) {
    throw new Error('Gamification likes require database')
  }

  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const windowRow = await ensureLikePointWindow(tx, userId, now)
    const windowState = evaluateLikeWindow(windowRow, now)

    const existing = await tx.productLike.findUnique({
      where: { productId_userId: { productId, userId } },
    })

    let liked: boolean

    if (existing) {
      await tx.productLike.delete({ where: { id: existing.id } })
      liked = false

      if (LIKE_UNDO_DECREMENTS_DAILY_COUNT && existing.countsForDailyBonus) {
        const freshWindow = await tx.userLikePointWindow.findUnique({ where: { userId } })
        if (freshWindow && !freshWindow.bonusGranted && freshWindow.qualifyingLikeCount > 0) {
          await tx.userLikePointWindow.update({
            where: { userId },
            data: { qualifyingLikeCount: { decrement: 1 } },
          })
        }
      }
    } else {
      const countsForDailyBonus = windowState.canEarnProgress
      await tx.productLike.create({
        data: { productId, userId, countsForDailyBonus },
      })
      liked = true

      if (countsForDailyBonus) {
        await tx.userLikePointWindow.update({
          where: { userId },
          data: { qualifyingLikeCount: { increment: 1 } },
        })
      }
    }

    const likesCount = await tx.productLike.count({ where: { productId } })
    await tx.product.update({
      where: { id: productId },
      data: { likesCount },
    })

    const updatedWindow = await tx.userLikePointWindow.findUniqueOrThrow({ where: { userId } })
    const evaluated = evaluateLikeWindow(updatedWindow, now)
    const dailyBonusQueued =
      liked &&
      evaluated.qualifyingLikeCount >= DAILY_LIKE_TARGET &&
      !updatedWindow.bonusGranted

    return {
      liked,
      likesCount,
      evaluated,
      dailyBonusQueued,
      windowStartedAt: updatedWindow.windowStartedAt,
    }
  })

  if (result.dailyBonusQueued) {
    await enqueuePointEvent({
      userId,
      type: 'LIKE_DAILY_BONUS',
      idempotencyKey: likeWindowBonusIdempotencyKey(userId, result.windowStartedAt),
      payload: { productId, windowStartedAt: result.windowStartedAt.toISOString() },
    })
  }

  return {
    liked: result.liked,
    likesCount: result.likesCount,
    ...toLikeMeta(result.evaluated),
    dailyBonusQueued: result.dailyBonusQueued,
  }
}

export async function getLikeGamificationStatus(userId: string) {
  const window = await getLikePointWindowStatus(userId)
  if (!window) return null
  return toLikeMeta(window)
}

export async function safeCreateLike(productId: string, userId: string): Promise<void> {
  try {
    await prisma.productLike.create({ data: { productId, userId } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return
    }
    throw e
  }
}
