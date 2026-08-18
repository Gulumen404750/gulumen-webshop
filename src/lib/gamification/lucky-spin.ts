import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  GAMIFICATION_TIMEZONE,
  LUCKY_SPIN_COOLDOWN_DAYS,
  LUCKY_SPIN_DISCOUNT_TIER_HIGH,
  LUCKY_SPIN_DISCOUNT_TIER_LOW,
  LUCKY_SPIN_DISCOUNT_TIER_MID,
  LUCKY_SPIN_MIN_ITEMS,
  LUCKY_SPIN_MIN_LIKES,
  LUCKY_SPIN_POINTS_EXTRA_PERCENT,
  LUCKY_SPIN_PRODUCT_COUNT,
  LUCKY_SPIN_VALIDITY_DAYS,
} from './constants'

/** Szerencsekerék kedvezmény % a listás termékek darabszáma és pontbeváltás alapján. */
export function calculateLuckySpinDiscountPercent(
  itemCount: number,
  usePoints = false
): number {
  if (itemCount <= 0) return 0
  let base =
    itemCount >= LUCKY_SPIN_MIN_ITEMS
      ? LUCKY_SPIN_DISCOUNT_TIER_HIGH
      : itemCount >= 5
        ? LUCKY_SPIN_DISCOUNT_TIER_MID
        : LUCKY_SPIN_DISCOUNT_TIER_LOW
  if (usePoints) base += LUCKY_SPIN_POINTS_EXTRA_PERCENT
  return base
}

/** Következő kedvezményszintig hátralévő darabszám (null = max. szint). */
export function getLuckySpinNextTierRemaining(itemCount: number): number | null {
  if (itemCount <= 0) return 1
  if (itemCount < 5) return 5 - itemCount
  if (itemCount < LUCKY_SPIN_MIN_ITEMS) return LUCKY_SPIN_MIN_ITEMS - itemCount
  return null
}

export type LuckySpinRecord = {
  id: string
  userId: string
  weekId: string
  productIds: string[]
  /** Pörgetéskor zárolt árak (productId → Ft). */
  priceSnapshot?: Record<string, number>
  generatedAt: Date
  expiresAt: Date
}

export type LuckySpinStatus = {
  spin: LuckySpinRecord | null
  canSpin: boolean
  nextSpinAt: string | null
  isExpired: boolean
  isActive: boolean
  /** Összes kedvelt termék száma – minimum LUCKY_SPIN_MIN_LIKES kell a pörgetéshez. */
  likesCount: number
  isEligible: boolean
}

/** ISO hét azonosító Europe/Budapest időzónában. */
export function getCurrentWeekId(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GAMIFICATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value ?? '1970')
  const m = Number(parts.find((p) => p.type === 'month')?.value ?? '1')
  const d = Number(parts.find((p) => p.type === 'day')?.value ?? '1')
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

async function pickSpinProducts(userId: string): Promise<string[]> {
  const [liked, dismissed] = await Promise.all([
    prisma.productLike.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.productDismiss.findMany({
      where: { userId },
      select: { productId: true },
    }),
  ])
  const blocked = new Set(dismissed.map((d) => d.productId))
  const likedIds = liked.map((l) => l.productId).filter((id) => !blocked.has(id))
  const shuffled = shuffleArray(likedIds)
  const selected = shuffled.slice(0, LUCKY_SPIN_PRODUCT_COUNT)

  if (selected.length < LUCKY_SPIN_PRODUCT_COUNT) {
    const needed = LUCKY_SPIN_PRODUCT_COUNT - selected.length
    const exclude = new Set([...selected, ...blocked])
    const filler = await prisma.product.findMany({
      where: {
        active: true,
        archived: false,
        id: { notIn: Array.from(exclude) },
        stock: { gt: 0 },
      },
      select: { id: true },
      take: needed * 3,
    })
    const fillerIds = shuffleArray(filler.map((p) => p.id)).slice(0, needed)
    selected.push(...fillerIds)
  }

  return selected.slice(0, LUCKY_SPIN_PRODUCT_COUNT)
}

function toRecord(row: {
  id: string
  userId: string
  weekId: string
  productIds: string[]
  priceSnapshot?: unknown
  generatedAt: Date
  expiresAt: Date
}): LuckySpinRecord {
  const snapshot =
    row.priceSnapshot && typeof row.priceSnapshot === 'object' && !Array.isArray(row.priceSnapshot)
      ? (row.priceSnapshot as Record<string, number>)
      : undefined
  return {
    id: row.id,
    userId: row.userId,
    weekId: row.weekId,
    productIds: row.productIds,
    priceSnapshot: snapshot,
    generatedAt: row.generatedAt,
    expiresAt: row.expiresAt,
  }
}

export async function getUserLikesCount(userId: string): Promise<number> {
  if (!isDbConfigured()) return 0
  return prisma.productLike.count({ where: { userId } })
}

export function isSpinActive(spin: LuckySpinRecord, now: Date = new Date()): boolean {
  return now.getTime() < spin.expiresAt.getTime()
}

export async function getLatestSpin(userId: string): Promise<LuckySpinRecord | null> {
  const row = await prisma.luckySpin.findFirst({
    where: { userId },
    orderBy: { generatedAt: 'desc' },
  })
  return row ? toRecord(row) : null
}

export async function getActiveSpin(userId: string, now: Date = new Date()): Promise<LuckySpinRecord | null> {
  const row = await prisma.luckySpin.findFirst({
    where: { userId, expiresAt: { gt: now } },
    orderBy: { generatedAt: 'desc' },
  })
  return row ? toRecord(row) : null
}

export async function canUserSpin(userId: string, now: Date = new Date()): Promise<boolean> {
  const latest = await getLatestSpin(userId)
  if (!latest) return true
  const cooldownMs = LUCKY_SPIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  return now.getTime() - latest.generatedAt.getTime() >= cooldownMs
}

export async function getLuckySpinStatus(userId: string, now: Date = new Date()): Promise<LuckySpinStatus> {
  const likesCount = await getUserLikesCount(userId)
  const isEligible = likesCount >= LUCKY_SPIN_MIN_LIKES
  const active = await getActiveSpin(userId, now)
  const canSpin = isEligible && (await canUserSpin(userId, now))
  const latest = active ?? (await getLatestSpin(userId))

  let nextSpinAt: string | null = null
  if (!canSpin && latest && isEligible) {
    const cooldownMs = LUCKY_SPIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    nextSpinAt = new Date(latest.generatedAt.getTime() + cooldownMs).toISOString()
  }

  return {
    spin: active,
    canSpin: canSpin && !active,
    nextSpinAt,
    isExpired: latest ? !isSpinActive(latest, now) : false,
    isActive: Boolean(active),
    likesCount,
    isEligible,
  }
}

/** GET /api/gamification/spin – ha jogosult, generál új pörgetést. */
export async function generateLuckySpin(userId: string, now: Date = new Date()): Promise<{
  ok: true
  spin: LuckySpinRecord
  created: boolean
} | {
  ok: false
  error: string
  status: number
}> {
  const likesCount = await getUserLikesCount(userId)
  if (likesCount < LUCKY_SPIN_MIN_LIKES) {
    return {
      ok: false,
      error: `Collect at least ${LUCKY_SPIN_MIN_LIKES} favorites to spin`,
      status: 403,
    }
  }

  const active = await getActiveSpin(userId, now)
  if (active) {
    return { ok: true, spin: active, created: false }
  }

  const canSpin = await canUserSpin(userId, now)
  if (!canSpin) {
    return { ok: false, error: 'Spin not available yet', status: 429 }
  }

  const weekId = getCurrentWeekId(now)
  const existing = await prisma.luckySpin.findUnique({
    where: { userId_weekId: { userId, weekId } },
  })
  if (existing && isSpinActive(toRecord(existing), now)) {
    return { ok: true, spin: toRecord(existing), created: false }
  }

  const productIds = await pickSpinProducts(userId)
  if (productIds.length === 0) {
    return { ok: false, error: 'No products available for spin', status: 400 }
  }

  const priceSnapshot: Record<string, number> = {}
  for (const id of productIds) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { priceHuf: true, discountPriceHuf: true },
    })
    if (product) {
      priceSnapshot[id] = product.discountPriceHuf ?? product.priceHuf
    }
  }

  const expiresAt = new Date(now.getTime() + LUCKY_SPIN_VALIDITY_DAYS * 24 * 60 * 60 * 1000)

  if (existing) {
    const row = await prisma.luckySpin.update({
      where: { id: existing.id },
      data: {
        productIds,
        priceSnapshot: priceSnapshot as object,
        generatedAt: now,
        expiresAt,
      },
    })
    return { ok: true, spin: toRecord(row), created: true }
  }

  try {
    const row = await prisma.luckySpin.create({
      data: {
        userId,
        weekId,
        productIds,
        priceSnapshot: priceSnapshot as object,
        generatedAt: now,
        expiresAt,
      },
    })
    return { ok: true, spin: toRecord(row), created: true }
  } catch (e) {
    const existingWeek = await prisma.luckySpin.findUnique({
      where: { userId_weekId: { userId, weekId } },
    })
    if (existingWeek && isSpinActive(toRecord(existingWeek), now)) {
      return { ok: true, spin: toRecord(existingWeek), created: false }
    }
    throw e
  }
}

export type CartItemForDiscount = { productId: string; qty: number; priceHuf: number }

export type LuckySpinDiscountResult = {
  active: boolean
  qualifyingItemCount: number
  discountPercent: number
  discountHuf: number
  spinProductIds: string[]
}

/** Tier kedvezmény a LuckySpin listában lévő termékekre (1+ db). */
export function computeLuckySpinDiscount(
  items: CartItemForDiscount[],
  spin: LuckySpinRecord | null,
  now: Date = new Date(),
  usePoints = false
): LuckySpinDiscountResult {
  const empty: LuckySpinDiscountResult = {
    active: false,
    qualifyingItemCount: 0,
    discountPercent: 0,
    discountHuf: 0,
    spinProductIds: spin?.productIds ?? [],
  }

  if (!spin || !isSpinActive(spin, now)) return empty

  const spinSet = new Set(spin.productIds)
  let qualifyingItemCount = 0
  let discountHuf = 0

  for (const item of items) {
    if (!spinSet.has(item.productId)) continue
    const lockedPrice = spin.priceSnapshot?.[item.productId]
    const unitPrice = lockedPrice != null && lockedPrice > 0 ? lockedPrice : item.priceHuf
    qualifyingItemCount += item.qty
  }

  if (qualifyingItemCount <= 0) {
    return { ...empty, spinProductIds: spin.productIds }
  }

  const discountPercent = calculateLuckySpinDiscountPercent(qualifyingItemCount, usePoints)

  for (const item of items) {
    if (!spinSet.has(item.productId)) continue
    const lockedPrice = spin.priceSnapshot?.[item.productId]
    const unitPrice = lockedPrice != null && lockedPrice > 0 ? lockedPrice : item.priceHuf
    discountHuf += Math.round(unitPrice * item.qty * discountPercent)
  }

  return {
    active: true,
    qualifyingItemCount,
    discountPercent,
    discountHuf,
    spinProductIds: spin.productIds,
  }
}

export async function getLuckySpinForCheckout(userId: string, now: Date = new Date()): Promise<LuckySpinRecord | null> {
  if (!isDbConfigured()) return null
  return getActiveSpin(userId, now)
}
