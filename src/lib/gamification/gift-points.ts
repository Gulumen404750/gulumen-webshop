/**
 * NFC / ajándékpontok: 1 pont = 1 Ft, teljes termékárra levásárolható,
 * aktiválástól 1 hónapig érvényes. Más kuponnal nem kombinálható.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { applyPointDelta } from '@/lib/gamification/point-ledger'
import {
  GIFT_POINT_VALIDITY_DAYS,
  POINT_TX_TYPES,
} from '@/lib/gamification/constants'
import { internalPointsLedgerMetadata } from '@/lib/order-points-accounting'

export type GiftPointGrantView = {
  id: string
  remaining: number
  expiresAt: Date
  activatedAt: Date
}

export function giftPointExpiresAt(
  activatedAt: Date,
  validityDays = GIFT_POINT_VALIDITY_DAYS
): Date {
  const expires = new Date(activatedAt.getTime())
  expires.setUTCDate(expires.getUTCDate() + validityDays)
  return expires
}

export function isGiftGrantActive(
  grant: { remaining: number; expiresAt: Date },
  now: Date = new Date()
): boolean {
  return grant.remaining > 0 && grant.expiresAt.getTime() > now.getTime()
}

export function sumAvailableGiftPoints(
  grants: Array<{ remaining: number; expiresAt: Date }>,
  now: Date = new Date()
): number {
  return grants.reduce((sum, grant) => (isGiftGrantActive(grant, now) ? sum + grant.remaining : sum), 0)
}

export function planGiftPointConsumption(
  grants: Array<{ id: string; remaining: number; expiresAt: Date }>,
  amount: number,
  now: Date = new Date()
): Array<{ id: string; take: number }> {
  let left = Math.max(0, Math.floor(amount))
  if (left <= 0) return []
  const active = grants
    .filter((g) => isGiftGrantActive(g, now))
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
  const plan: Array<{ id: string; take: number }> = []
  for (const grant of active) {
    if (left <= 0) break
    const take = Math.min(grant.remaining, left)
    if (take > 0) {
      plan.push({ id: grant.id, take })
      left -= take
    }
  }
  return plan
}

export async function getAvailableGiftPoints(
  userId: string,
  now: Date = new Date()
): Promise<number> {
  if (!isDbConfigured()) return 0
  const grants = await prisma.giftPointGrant.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
    select: { remaining: true, expiresAt: true },
  })
  return sumAvailableGiftPoints(grants, now)
}

export async function listActiveGiftGrants(
  userId: string,
  now: Date = new Date()
): Promise<GiftPointGrantView[]> {
  if (!isDbConfigured()) return []
  const grants = await prisma.giftPointGrant.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: { expiresAt: 'asc' },
    select: { id: true, remaining: true, expiresAt: true, activatedAt: true },
  })
  return grants
}

export async function grantNfcGiftPoints(input: {
  userId: string
  points: number
  nfcTagId?: string | null
  source?: 'nfc' | 'admin' | 'claim'
  codeId?: string | null
  now?: Date
}): Promise<{ grantId: string; expiresAt: Date; balanceAfter: number | null }> {
  const points = Math.floor(input.points)
  if (points <= 0) {
    throw new Error('Gift points must be positive')
  }
  const now = input.now ?? new Date()
  const expiresAt = giftPointExpiresAt(now)
  const nfcTagId = input.nfcTagId?.trim() || null
  const source = input.source ?? 'nfc'
  const codeId = input.codeId?.trim() || null
  const txType = source === 'claim' ? POINT_TX_TYPES.GIFT_POINT_CLAIM : POINT_TX_TYPES.NFC_GIFT
  const idempotencyKey = codeId
    ? `gift-claim:${codeId}`
    : nfcTagId
      ? `nfc-gift:${input.userId}:${nfcTagId}`
      : `nfc-gift:${input.userId}:${now.toISOString()}:${points}`

  const delta = await applyPointDelta({
    userId: input.userId,
    delta: points,
    type: txType,
    idempotencyKey,
    reason: source === 'claim' ? 'Ajándékpont aktiválás' : 'NFC ajándékpont jóváírás',
    referenceType: source === 'claim' ? 'gift_point_code' : 'nfc_gift',
    referenceId: codeId ?? nfcTagId ?? undefined,
    metadata: internalPointsLedgerMetadata({
      nfcTagId,
      codeId,
      source,
      expiresAt: expiresAt.toISOString(),
    }),
  })

  if (delta.duplicate) {
    if (delta.transaction.userId !== input.userId) {
      throw new Error('Gift point already claimed')
    }
    const existing = await prisma.giftPointGrant.findFirst({
      where: {
        userId: input.userId,
        ...(nfcTagId ? { nfcTagId } : {}),
        ...(source === 'claim' ? { source: 'claim' } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      return {
        grantId: existing.id,
        expiresAt: existing.expiresAt,
        balanceAfter: delta.wallet?.balance ?? null,
      }
    }
  }

  const grant = await prisma.giftPointGrant.create({
    data: {
      userId: input.userId,
      points,
      remaining: points,
      source,
      nfcTagId,
      activatedAt: now,
      expiresAt,
    },
  })

  return {
    grantId: grant.id,
    expiresAt: grant.expiresAt,
    balanceAfter: delta.wallet?.balance ?? null,
  }
}

export async function consumeGiftPointsForOrder(
  userId: string,
  pointsUsed: number,
  now: Date = new Date()
): Promise<number> {
  const amount = Math.max(0, Math.floor(pointsUsed))
  if (amount <= 0 || !isDbConfigured()) return 0
  const grants = await prisma.giftPointGrant.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: { expiresAt: 'asc' },
    select: { id: true, remaining: true, expiresAt: true },
  })
  const plan = planGiftPointConsumption(grants, amount, now)
  let consumed = 0
  for (const step of plan) {
    await prisma.giftPointGrant.update({
      where: { id: step.id },
      data: { remaining: { decrement: step.take } },
    })
    consumed += step.take
  }
  return consumed
}
