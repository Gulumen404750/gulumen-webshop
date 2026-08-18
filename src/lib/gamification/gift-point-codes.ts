/**
 * Ajándékpont-kódok: darabszámos generálás, egyedi /claim token, egyszer használatos aktiválás.
 */

import { randomBytes } from 'crypto'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { GIFT_POINT_VALIDITY_DAYS } from '@/lib/gamification/constants'
import { grantNfcGiftPoints } from '@/lib/gamification/gift-points'

export const MAX_GIFT_POINT_QUANTITY = 100
export const MAX_GIFT_POINT_VALUE = 1_000_000
export const GIFT_POINT_TOKEN_LENGTH = 12

/** Egyértelmű, NFC/QR-barát ábécé (0/O/I/1 nélkül). */
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type GiftCodeClaimStatus =
  | 'available'
  | 'used'
  | 'inactive'
  | 'expired'
  | 'not_yet_valid'
  | 'not_found'

export type GiftCodePreview = {
  status: GiftCodeClaimStatus
  points: number | null
  batchCode: string | null
}

export type ClaimGiftPointResult =
  | {
      ok: true
      alreadyClaimedByYou?: boolean
      points: number
      grantId: string
      expiresAt: Date
      balanceAfter: number | null
      token: string
    }
  | {
      ok: false
      reason:
        | 'not_found'
        | 'inactive'
        | 'expired'
        | 'not_yet_valid'
        | 'already_used'
        | 'db_unavailable'
        | 'grant_failed'
    }

export function normalizeGiftPointToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '')
}

export function generateGiftPointToken(length = GIFT_POINT_TOKEN_LENGTH): string {
  const buf = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[buf[i]! % TOKEN_ALPHABET.length]
  }
  return out
}

export function getPublicAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gulumen.com').replace(/\/$/, '')
}

export function buildGiftPointClaimPath(token: string): string {
  return `/claim/${encodeURIComponent(normalizeGiftPointToken(token))}`
}

export function buildGiftPointClaimUrl(token: string, baseUrl = getPublicAppBaseUrl()): string {
  return `${baseUrl.replace(/\/$/, '')}${buildGiftPointClaimPath(token)}`
}

export function isGiftBatchInClaimWindow(
  batch: { validFrom: Date | null; validUntil: Date | null; active: boolean },
  now: Date = new Date()
): GiftCodeClaimStatus {
  if (!batch.active) return 'inactive'
  if (batch.validFrom && now < batch.validFrom) return 'not_yet_valid'
  if (batch.validUntil && now > batch.validUntil) return 'expired'
  return 'available'
}

export function previewStatusForCode(
  code: {
    active: boolean
    claimedAt: Date | null
    batch: { active: boolean; validFrom: Date | null; validUntil: Date | null }
  },
  now: Date = new Date()
): GiftCodeClaimStatus {
  if (code.claimedAt) return 'used'
  if (!code.active) return 'inactive'
  return isGiftBatchInClaimWindow(code.batch, now)
}

async function uniqueGiftPointToken(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = generateGiftPointToken()
    const existing = await prisma.giftPointCode.findUnique({
      where: { token },
      select: { id: true },
    })
    if (!existing) return token
  }
  throw new Error('Could not allocate a unique gift-point token')
}

export async function createGiftPointBatch(input: {
  code: string
  points: number
  quantity: number
  validFrom?: Date | null
  validUntil?: Date | null
  createdByUserId?: string | null
}): Promise<{
  id: string
  code: string
  points: number
  quantity: number
  tokens: string[]
}> {
  if (!isDbConfigured()) {
    throw new Error('Database not configured')
  }
  const points = Math.floor(input.points)
  const quantity = Math.floor(input.quantity)
  if (points < 1 || points > MAX_GIFT_POINT_VALUE) {
    throw new Error('Invalid gift point value')
  }
  if (quantity < 1 || quantity > MAX_GIFT_POINT_QUANTITY) {
    throw new Error('Invalid gift point quantity')
  }

  const batchCode = input.code.trim().toUpperCase()
  const tokens: string[] = []
  for (let i = 0; i < quantity; i++) {
    tokens.push(await uniqueGiftPointToken())
  }

  const batch = await prisma.giftPointBatch.create({
    data: {
      code: batchCode,
      points,
      quantity,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      createdByUserId: input.createdByUserId ?? null,
      codes: {
        create: tokens.map((token) => ({ token })),
      },
    },
  })

  return { id: batch.id, code: batch.code, points: batch.points, quantity: batch.quantity, tokens }
}

export async function addGiftPointCodesToBatch(
  batchId: string,
  extraQuantity: number
): Promise<{ tokens: string[]; quantity: number }> {
  const extra = Math.floor(extraQuantity)
  if (extra < 1) throw new Error('Invalid gift point quantity')

  const batch = await prisma.giftPointBatch.findUnique({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')
  if (batch.quantity + extra > MAX_GIFT_POINT_QUANTITY) {
    throw new Error('Invalid gift point quantity')
  }

  const tokens: string[] = []
  for (let i = 0; i < extra; i++) {
    tokens.push(await uniqueGiftPointToken())
  }
  await prisma.$transaction([
    prisma.giftPointCode.createMany({
      data: tokens.map((token) => ({ batchId, token })),
    }),
    prisma.giftPointBatch.update({
      where: { id: batchId },
      data: { quantity: { increment: extra } },
    }),
  ])
  return { tokens, quantity: batch.quantity + extra }
}

export async function findGiftPointCodeByToken(token: string) {
  if (!isDbConfigured()) return null
  const normalized = normalizeGiftPointToken(token)
  if (!normalized) return null
  return prisma.giftPointCode.findUnique({
    where: { token: normalized },
    include: { batch: true },
  })
}

/** Admin címke (pl. AJANDEK5000): első még fel nem használt token a tételből. */
export async function findUnclaimedGiftPointCodeByBatchLabel(batchCode: string) {
  if (!isDbConfigured()) return null
  const labels = Array.from(
    new Set(
      [batchCode.trim().toUpperCase(), normalizeGiftPointToken(batchCode)].filter(
        (s) => s.length > 0
      )
    )
  )
  if (labels.length === 0) return null
  return prisma.giftPointCode.findFirst({
    where: {
      claimedAt: null,
      active: true,
      batch: { code: { in: labels }, active: true },
    },
    orderBy: { createdAt: 'asc' },
    include: { batch: true },
  })
}

export async function previewGiftPointCode(
  token: string,
  now: Date = new Date()
): Promise<GiftCodePreview> {
  const code = await findGiftPointCodeByToken(token)
  if (!code) {
    return { status: 'not_found', points: null, batchCode: null }
  }
  return {
    status: previewStatusForCode(code, now),
    points: code.batch.points,
    batchCode: code.batch.code,
  }
}

export async function claimGiftPointCode(input: {
  token: string
  userId: string
  now?: Date
}): Promise<ClaimGiftPointResult> {
  if (!isDbConfigured()) {
    return { ok: false, reason: 'db_unavailable' }
  }

  const now = input.now ?? new Date()
  const code = await findGiftPointCodeByToken(input.token)
  if (!code) return { ok: false, reason: 'not_found' }

  if (code.claimedAt) {
    if (code.claimedByUserId === input.userId && code.grantId) {
      const grant = await prisma.giftPointGrant.findUnique({ where: { id: code.grantId } })
      if (grant) {
        return {
          ok: true,
          alreadyClaimedByYou: true,
          points: grant.points,
          grantId: grant.id,
          expiresAt: grant.expiresAt,
          balanceAfter: null,
          token: code.token,
        }
      }
    }
    return { ok: false, reason: 'already_used' }
  }

  const windowStatus = previewStatusForCode(code, now)
  if (windowStatus !== 'available') {
    return { ok: false, reason: windowStatus === 'used' ? 'already_used' : windowStatus }
  }

  const claimed = await prisma.giftPointCode.updateMany({
    where: { id: code.id, claimedAt: null, active: true },
    data: {
      claimedAt: now,
      claimedByUserId: input.userId,
      active: false,
    },
  })
  if (claimed.count === 0) {
    const fresh = await prisma.giftPointCode.findUnique({ where: { id: code.id } })
    if (fresh?.claimedByUserId === input.userId) {
      return claimGiftPointCode({ ...input, now })
    }
    return { ok: false, reason: 'already_used' }
  }

  try {
    const granted = await grantNfcGiftPoints({
      userId: input.userId,
      points: code.batch.points,
      source: 'claim',
      codeId: code.id,
      nfcTagId: code.token,
      now,
    })
    await prisma.giftPointCode.update({
      where: { id: code.id },
      data: { grantId: granted.grantId },
    })
    return {
      ok: true,
      points: code.batch.points,
      grantId: granted.grantId,
      expiresAt: granted.expiresAt,
      balanceAfter: granted.balanceAfter,
      token: code.token,
    }
  } catch {
    await prisma.giftPointCode.updateMany({
      where: { id: code.id, claimedByUserId: input.userId },
      data: { claimedAt: null, claimedByUserId: null, grantId: null, active: true },
    })
    return { ok: false, reason: 'grant_failed' }
  }
}

export function giftPointValidityDays(): number {
  return GIFT_POINT_VALIDITY_DAYS
}
