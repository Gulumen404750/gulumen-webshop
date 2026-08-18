/**
 * Hűségkedvezmény: emailhez kötött, minősített fizetett vásárlásszám alapján.
 * 50 000 Ft+ kártyás fizetésenként +1%, max. 8%. Nem összevonható más kuponnal.
 * Élesben Prisma LoyaltyRecord (Railway); DATABASE_URL nélkül JSON fallback.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'

export type LoyaltyTier = 'bronze' | 'silver' | 'gold'

export const LOYALTY_THRESHOLD_HUF = 50_000
export const LOYALTY_MAX_PERCENT = 8

/** Hűségszint a minősített rendelésszám alapján. 0 rendelés → null (nincs badge). */
export function getLoyaltyTier(orderCount: number): LoyaltyTier | null {
  if (orderCount <= 0) return null
  if (orderCount <= 2) return 'bronze'
  if (orderCount <= 5) return 'silver'
  return 'gold'
}

export function loyaltyPercentFromCount(count: number): number {
  return Math.min(Math.max(0, Math.floor(count)), LOYALTY_MAX_PERCENT)
}

export type LoyaltyRecord = {
  email: string
  qualifyingPaidOrdersCount: number
  loyaltyPercent: number
  lastUpdatedAt: string
  userId?: string | null
}

export type LoyaltyCreditResult = {
  credited: boolean
  alreadyCounted: boolean
  qualified: boolean
  loyaltyPercent: number
  previousPercent: number
  qualifyingPaidOrdersCount: number
}

const PAID_LIKE = new Set(['paid', 'sourcing_pending', 'fulfilled'])

function getFxHufPerEur(): number {
  const v = process.env.FX_HUF_PER_EUR
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : 390
}

/** EUR küszöb: 50 000 Ft / árfolyam, 2 tizedes. */
export function getThresholdEur(): number {
  const fx = getFxHufPerEur()
  return Math.round((LOYALTY_THRESHOLD_HUF / fx) * 100) / 100
}

export function getThresholdHuf(): number {
  return LOYALTY_THRESHOLD_HUF
}

/** Stripe amount_total alapján minősül-e a vásárlás (HUF zero-decimal, EUR cent). */
export function qualifiesForLoyalty(amountTotal: number, currency: string): boolean {
  const curr = (currency || 'huf').toLowerCase()
  if (curr === 'huf') {
    return amountTotal >= LOYALTY_THRESHOLD_HUF
  }
  if (curr === 'eur') {
    const amountEur = amountTotal / 100
    return amountEur >= getThresholdEur()
  }
  return false
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const LOYALTY_FILE = 'data/loyalty.json'
let memoryStore: LoyaltyRecord[] = []
let loaded = false

function getLoyaltyPath(): string {
  const path = require('path') as typeof import('path')
  return path.join(process.cwd(), LOYALTY_FILE)
}

function loadLoyalty(): LoyaltyRecord[] {
  if (loaded) return memoryStore
  try {
    const fs = require('fs') as typeof import('fs')
    const p = getLoyaltyPath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8')
      const parsed = JSON.parse(raw) as unknown
      memoryStore = Array.isArray(parsed) ? (parsed as LoyaltyRecord[]) : []
    } else {
      memoryStore = []
    }
  } catch {
    memoryStore = []
  }
  loaded = true
  return memoryStore
}

function saveLoyalty(): void {
  try {
    const fs = require('fs') as typeof import('fs')
    const path = require('path') as typeof import('path')
    const p = getLoyaltyPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(p, JSON.stringify(memoryStore, null, 2), 'utf-8')
  } catch {
    /* élesben a Prisma az igazság */
  }
}

function toPublicRecord(row: {
  email: string
  qualifyingPaidOrdersCount: number
  loyaltyPercent: number
  lastUpdatedAt: Date | string
  userId?: string | null
}): LoyaltyRecord {
  return {
    email: row.email,
    qualifyingPaidOrdersCount: row.qualifyingPaidOrdersCount,
    loyaltyPercent: row.loyaltyPercent,
    lastUpdatedAt:
      typeof row.lastUpdatedAt === 'string' ? row.lastUpdatedAt : row.lastUpdatedAt.toISOString(),
    userId: row.userId ?? null,
  }
}

export async function getLoyaltyByEmail(email: string): Promise<LoyaltyRecord | null> {
  const key = normalizeEmail(email)
  if (!key) return null

  if (isDbConfigured()) {
    try {
      const row = await prisma.loyaltyRecord.findUnique({ where: { email: key } })
      return row ? toPublicRecord(row) : null
    } catch {
      /* fallback JSON */
    }
  }

  const records = loadLoyalty()
  return records.find((r) => normalizeEmail(r.email) === key) ?? null
}

async function resolveUserIdByEmail(email: string): Promise<string | null> {
  if (!isDbConfigured()) return null
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    return user?.id ?? null
  } catch {
    return null
  }
}

/** Minősített vásárlás növelése (idempotenciát a hívó biztosítja: countedForLoyalty). */
export async function incrementQualifyingOrder(
  email: string,
  userId?: string | null
): Promise<LoyaltyRecord> {
  const key = normalizeEmail(email)
  const now = new Date()
  const resolvedUserId = userId || (await resolveUserIdByEmail(key))

  if (isDbConfigured()) {
    try {
      const existing = await prisma.loyaltyRecord.findUnique({ where: { email: key } })
      if (!existing) {
        const created = await prisma.loyaltyRecord.create({
          data: {
            email: key,
            userId: resolvedUserId,
            qualifyingPaidOrdersCount: 1,
            loyaltyPercent: 1,
          },
        })
        return toPublicRecord(created)
      }
      const nextCount = existing.qualifyingPaidOrdersCount + 1
      const updated = await prisma.loyaltyRecord.update({
        where: { email: key },
        data: {
          qualifyingPaidOrdersCount: nextCount,
          loyaltyPercent: loyaltyPercentFromCount(nextCount),
          ...(resolvedUserId && !existing.userId ? { userId: resolvedUserId } : {}),
        },
      })
      return toPublicRecord(updated)
    } catch {
      /* JSON fallback, ha a Prisma hívás elhasal */
    }
  }

  const records = loadLoyalty()
  const idx = records.findIndex((r) => normalizeEmail(r.email) === key)
  let record: LoyaltyRecord
  if (idx >= 0) {
    record = records[idx]!
    record.qualifyingPaidOrdersCount += 1
    record.loyaltyPercent = loyaltyPercentFromCount(record.qualifyingPaidOrdersCount)
    record.lastUpdatedAt = now.toISOString()
    if (resolvedUserId) record.userId = resolvedUserId
  } else {
    record = {
      email: key,
      qualifyingPaidOrdersCount: 1,
      loyaltyPercent: 1,
      lastUpdatedAt: now.toISOString(),
      userId: resolvedUserId,
    }
    records.push(record)
  }
  memoryStore = records
  saveLoyalty()
  return record
}

/** Teljes visszatérítés: -1 count (min 0). */
export async function decrementQualifyingOrder(email: string): Promise<LoyaltyRecord | null> {
  const key = normalizeEmail(email)

  if (isDbConfigured()) {
    try {
      const existing = await prisma.loyaltyRecord.findUnique({ where: { email: key } })
      if (!existing) return null
      const nextCount = Math.max(0, existing.qualifyingPaidOrdersCount - 1)
      if (nextCount === 0) {
        await prisma.loyaltyRecord.delete({ where: { email: key } })
        return null
      }
      const updated = await prisma.loyaltyRecord.update({
        where: { email: key },
        data: {
          qualifyingPaidOrdersCount: nextCount,
          loyaltyPercent: loyaltyPercentFromCount(nextCount),
        },
      })
      return toPublicRecord(updated)
    } catch {
      /* JSON fallback */
    }
  }

  const records = loadLoyalty()
  const idx = records.findIndex((r) => normalizeEmail(r.email) === key)
  if (idx < 0) return null
  const record = records[idx]!
  record.qualifyingPaidOrdersCount = Math.max(0, record.qualifyingPaidOrdersCount - 1)
  record.loyaltyPercent = loyaltyPercentFromCount(record.qualifyingPaidOrdersCount)
  record.lastUpdatedAt = new Date().toISOString()
  if (record.qualifyingPaidOrdersCount === 0) {
    records.splice(idx, 1)
    memoryStore = records
    saveLoyalty()
    return null
  }
  memoryStore = records
  saveLoyalty()
  return record
}

const EMPTY_CREDIT: LoyaltyCreditResult = {
  credited: false,
  alreadyCounted: false,
  qualified: false,
  loyaltyPercent: 0,
  previousPercent: 0,
  qualifyingPaidOrdersCount: 0,
}

/**
 * Sikeres fizetés után: a rendelés(csoport) kártyás végösszege ≥ 50 000 Ft → +1%.
 * Csoportonként egyszer (countedForLoyalty).
 */
export async function applyLoyaltyForPaidOrder(orderId: string): Promise<LoyaltyCreditResult> {
  const {
    getOrderById,
    getOrdersByGroupId,
    setOrderCountedForLoyalty,
    claimOrdersCountedForLoyalty,
  } = await import('@/lib/orders')
  const order = await getOrderById(orderId)
  if (!order) return { ...EMPTY_CREDIT }

  const email = order.customerEmail?.trim().toLowerCase() || ''
  const current = email ? await getLoyaltyByEmail(email) : null
  const snapshot = {
    loyaltyPercent: current?.loyaltyPercent ?? 0,
    qualifyingPaidOrdersCount: current?.qualifyingPaidOrdersCount ?? 0,
  }

  if (!PAID_LIKE.has(order.status)) {
    return { ...EMPTY_CREDIT, ...snapshot, qualified: false }
  }
  if (!email) {
    return { ...EMPTY_CREDIT, ...snapshot }
  }

  const siblings =
    order.orderGroupId ? await getOrdersByGroupId(order.orderGroupId) : [order]
  const paidSiblings = siblings.filter((o) => PAID_LIKE.has(o.status))
  if (paidSiblings.some((o) => o.countedForLoyalty)) {
    return {
      credited: false,
      alreadyCounted: true,
      qualified: true,
      ...snapshot,
    }
  }

  const paidHuf = paidSiblings.reduce((sum, o) => sum + (o.totalHuf || 0), 0)
  if (!qualifiesForLoyalty(paidHuf, 'huf')) {
    return { ...EMPTY_CREDIT, ...snapshot, qualified: false }
  }

  const claimedCount = await claimOrdersCountedForLoyalty(paidSiblings.map((o) => o.id))
  if (claimedCount === 0) {
    return {
      credited: false,
      alreadyCounted: true,
      qualified: true,
      ...snapshot,
    }
  }

  const previousPercent = snapshot.loyaltyPercent
  try {
    const updated = await incrementQualifyingOrder(email, order.userId)
    return {
      credited: true,
      alreadyCounted: false,
      qualified: true,
      loyaltyPercent: updated.loyaltyPercent,
      previousPercent,
      qualifyingPaidOrdersCount: updated.qualifyingPaidOrdersCount,
    }
  } catch (err) {
    for (const o of paidSiblings) {
      try {
        await setOrderCountedForLoyalty(o.id, false)
      } catch {
        /* non-fatal */
      }
    }
    throw err
  }
}
