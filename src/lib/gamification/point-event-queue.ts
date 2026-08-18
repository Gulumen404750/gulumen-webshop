/**
 * Outbox pattern: API gyorsan enqueue-ol, worker háttérben jóváír.
 * Next.js: `after()` hívható a route végén fire-and-forget feldolgozásra.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  POINT_EVENT_BATCH_SIZE,
  POINTS_BROWSE_5MIN,
  POINTS_DAILY_LIKE_BONUS,
  POINT_TX_TYPES,
  BROWSE_DAILY_TARGET_SECONDS,
  BROWSE_DAILY_MAX_BONUSES,
  DAILY_LIKE_TARGET,
} from './constants'
import {
  canGrantBrowseBonus,
  browseBonusLedgerKey,
} from './browse-bonus'
import { getGamificationDate } from './dates'
import { applyPointDelta, ensurePointWallet } from './point-ledger'

export type EnqueuePointEventInput = {
  userId: string
  type: string
  idempotencyKey: string
  payload?: Record<string, unknown>
  scheduledAt?: Date
}

/** Gyors: csak INSERT PointEvent (pending). Dupla kulcs → no-op. */
export async function enqueuePointEvent(input: EnqueuePointEventInput): Promise<{ enqueued: boolean; eventId?: string }> {
  try {
    const event = await prisma.pointEvent.create({
      data: {
        userId: input.userId,
        type: input.type,
        idempotencyKey: input.idempotencyKey,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        scheduledAt: input.scheduledAt ?? new Date(),
        status: 'pending',
      },
    })
    return { enqueued: true, eventId: event.id }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { enqueued: false }
    }
    throw e
  }
}

async function processBrowse5MinEvent(userId: string, payload: Record<string, unknown>): Promise<boolean> {
  const activityDate = getGamificationDate()
  const activity = await prisma.userDailyActivity.findUnique({
    where: { userId_activityDate: { userId, activityDate } },
  })
  if (!activity) return false
  if (!canGrantBrowseBonus(activity)) return false

  const dateKey = activityDate.toISOString().slice(0, 10)
  const bonusIndex =
    typeof payload.bonusIndex === 'number'
      ? payload.bonusIndex
      : activity.bonusGrantedCount + 1

  if (bonusIndex !== activity.bonusGrantedCount + 1) return false

  await applyPointDelta({
    userId,
    delta: POINTS_BROWSE_5MIN,
    type: POINT_TX_TYPES.BROWSE_5MIN,
    idempotencyKey: browseBonusLedgerKey(userId, dateKey, bonusIndex),
    reason: `Aktív böngészés bónusz (${bonusIndex}/${BROWSE_DAILY_MAX_BONUSES})`,
    referenceType: 'browse_day',
    referenceId: `${dateKey}:${bonusIndex}`,
    metadata: payload,
  })

  const newCount = activity.bonusGrantedCount + 1
  await prisma.userDailyActivity.update({
    where: { userId_activityDate: { userId, activityDate } },
    data: {
      bonusGrantedCount: newCount,
      lastBonusGrantedAt: new Date(),
      sessionProgressSeconds: 0,
    },
  })
  return true
}

async function processLikeDailyBonusEvent(userId: string, payload: Record<string, unknown>): Promise<boolean> {
  const window = await prisma.userLikePointWindow.findUnique({ where: { userId } })
  if (!window || window.bonusGranted) return false
  if (window.qualifyingLikeCount < DAILY_LIKE_TARGET) return false

  const windowStartedAt =
    typeof payload.windowStartedAt === 'string'
      ? new Date(payload.windowStartedAt)
      : window.windowStartedAt

  if (windowStartedAt.getTime() !== window.windowStartedAt.getTime()) return false

  await applyPointDelta({
    userId,
    delta: POINTS_DAILY_LIKE_BONUS,
    type: POINT_TX_TYPES.LIKE_DAILY_BONUS,
    idempotencyKey: `like-window:${userId}:${windowStartedAt.getTime()}`,
    reason: '10 kedvenc bónusz (12 órás ablak)',
    referenceType: 'like_window',
    referenceId: String(windowStartedAt.getTime()),
    metadata: payload,
  })

  await prisma.userLikePointWindow.update({
    where: { userId },
    data: { bonusGranted: true },
  })
  return true
}

async function processPurchaseRedeemEvent(userId: string, payload: Record<string, unknown>): Promise<boolean> {
  const orderId = typeof payload.orderId === 'string' ? payload.orderId : null
  const pointsUsed = typeof payload.pointsUsed === 'number' ? payload.pointsUsed : 0
  if (!orderId || pointsUsed <= 0) return false

  await applyPointDelta({
    userId,
    delta: -pointsUsed,
    type: POINT_TX_TYPES.PURCHASE_REDEEM,
    idempotencyKey: `purchase-redeem:${orderId}`,
    reason: 'Pont felhasználás vásárláskor',
    referenceType: 'order',
    referenceId: orderId,
    metadata: payload,
  })
  return true
}

async function processLuckySpinBonusEvent(_userId: string, _payload: Record<string, unknown>): Promise<boolean> {
  // A +5% már checkout kedvezmény; a felhasznált pontok után ne írjunk vissza phantom egyenleget.
  return true
}

async function dispatchEvent(
  type: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  switch (type) {
    case 'BROWSE_5MIN':
      return processBrowse5MinEvent(userId, payload)
    case 'LIKE_DAILY_BONUS':
      return processLikeDailyBonusEvent(userId, payload)
    case 'PURCHASE_REDEEM':
      return processPurchaseRedeemEvent(userId, payload)
    case 'LUCKY_SPIN_BONUS':
      return processLuckySpinBonusEvent(userId, payload)
    default:
      throw new Error(`Unknown point event type: ${type}`)
  }
}

/** Worker: cron vagy route await – batch feldolgozás. */
export async function processPendingPointEvents(
  limit = POINT_EVENT_BATCH_SIZE,
  userId?: string
): Promise<number> {
  const now = new Date()
  const pending = await prisma.pointEvent.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
      ...(userId ? { userId } : {}),
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit * 2,
  })

  const eligible = pending.filter((e: { attempts: number; maxAttempts: number }) => e.attempts < e.maxAttempts).slice(0, limit)

  let processed = 0
  for (const event of eligible) {
    const claimed = await prisma.pointEvent.updateMany({
      where: { id: event.id, status: 'pending' },
      data: { status: 'processing', attempts: { increment: 1 } },
    })
    if (claimed.count === 0) continue

    try {
      await ensurePointWallet(event.userId)
      const payload = (event.payload ?? {}) as Record<string, unknown>
      const applied = await dispatchEvent(event.type, event.userId, payload)
      if (!applied) {
        await prisma.pointEvent.update({
          where: { id: event.id },
          data: {
            status: 'pending',
            attempts: event.attempts,
            lastError: 'preconditions_not_met',
          },
        })
        continue
      }
      await prisma.pointEvent.update({
        where: { id: event.id },
        data: { status: 'completed', processedAt: new Date(), lastError: null },
      })
      processed++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const failed = event.attempts + 1 >= event.maxAttempts
      await prisma.pointEvent.update({
        where: { id: event.id },
        data: {
          status: failed ? 'failed' : 'pending',
          lastError: message.slice(0, 500),
        },
      })
    }
  }

  return processed
}

/** Napi snapshot (cron, éjfél után). */
export async function upsertDailyPointSnapshot(userId: string, date = getGamificationDate()): Promise<void> {
  const [wallet, txCount] = await Promise.all([
    prisma.userPointWallet.findUnique({ where: { userId } }),
    prisma.pointTransaction.count({
      where: {
        userId,
        createdAt: {
          gte: date,
          lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])
  if (!wallet) return

  await prisma.pointSnapshot.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, balance: wallet.balance, txCount },
    update: { balance: wallet.balance, txCount },
  })
}
