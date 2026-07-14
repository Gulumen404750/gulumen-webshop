/**
 * ProductLike – userhez kötött kedvelések (privát), számláló publikus.
 * DB (Prisma) ha DATABASE_URL be van állítva, különben fájl fallback dev-hez.
 */

import path from 'path'
import fs from 'fs'
import { isDbConfigured, prisma } from '@/lib/prisma'
import { toggleLikeWithGamification } from '@/lib/gamification/like-gamification'

const DATA_DIR = path.join(process.cwd(), 'data')
const PRODUCT_LIKES_FILE = path.join(DATA_DIR, 'product-likes.json')

export type ProductLikeRecord = {
  productId: string
  userId: string
  createdAt: string
}

export type ToggleLikeResult = {
  liked: boolean
  likesCount: number
  qualifyingLikeCount?: number
  qualifyingLikeTarget?: number
  pointLimitReached?: boolean
  canEarnLikeProgress?: boolean
  windowResetsAt?: string | null
  dailyBonusQueued?: boolean
  /** @deprecated */
  dailyLikeCount?: number
  /** @deprecated */
  dailyLikeTarget?: number
}

function loadRecords(): ProductLikeRecord[] {
  try {
    if (fs.existsSync(PRODUCT_LIKES_FILE)) {
      const raw = fs.readFileSync(PRODUCT_LIKES_FILE, 'utf-8')
      const data = JSON.parse(raw)
      const arr = Array.isArray(data) ? data : []
      return arr.filter(
        (r): r is ProductLikeRecord =>
          typeof r?.productId === 'string' && typeof r?.userId === 'string' && typeof r?.createdAt === 'string'
      )
    }
  } catch {
    // ignore
  }
  return []
}

function saveRecords(records: ProductLikeRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(PRODUCT_LIKES_FILE, JSON.stringify(records, null, 0), 'utf-8')
  } catch {
    // read-only
  }
}

function fileGetLikesCount(productId: string): number {
  return loadRecords().filter((r) => r.productId === productId).length
}

function legacyUserId(email: string): string {
  return `user-${email.trim().toLowerCase()}`
}

function userIdsForLookup(userId: string, email?: string): Set<string> {
  const ids = new Set<string>([userId])
  if (email) ids.add(legacyUserId(email))
  return ids
}

function fileGetLikedProductIdsByUser(userId: string, email?: string): string[] {
  const userIds = userIdsForLookup(userId, email)
  return Array.from(
    new Set(loadRecords().filter((r) => userIds.has(r.userId)).map((r) => r.productId))
  )
}

function fileHasLike(productId: string, userId: string, email?: string): boolean {
  const userIds = userIdsForLookup(userId, email)
  return loadRecords().some((r) => r.productId === productId && userIds.has(r.userId))
}

function fileToggleLike(productId: string, userId: string, email?: string): { liked: boolean; likesCount: number } {
  const records = loadRecords()
  const userIds = userIdsForLookup(userId, email)
  const idx = records.findIndex((r) => r.productId === productId && userIds.has(r.userId))
  if (idx >= 0) {
    records.splice(idx, 1)
    saveRecords(records)
    return { liked: false, likesCount: records.filter((r) => r.productId === productId).length }
  }
  records.push({ productId, userId, createdAt: new Date().toISOString() })
  saveRecords(records)
  return { liked: true, likesCount: records.filter((r) => r.productId === productId).length }
}


/** Nyilvános: termékre vonatkozó like-ok száma. */
export async function getLikesCount(productId: string): Promise<number> {
  if (isDbConfigured()) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { likesCount: true },
    })
    return product?.likesCount ?? 0
  }
  return fileGetLikesCount(productId)
}

/** User ezt a terméket kedveli-e (privát állapot). */
export async function hasLike(productId: string, userId: string, email?: string): Promise<boolean> {
  if (isDbConfigured()) {
    const row = await prisma.productLike.findUnique({
      where: { productId_userId: { productId, userId } },
    })
    return Boolean(row)
  }
  return fileHasLike(productId, userId, email)
}

/**
 * Toggle like. Vissza: { liked, likesCount, dailyLikeCount?, ... }
 */
export async function toggleLike(
  productId: string,
  userId: string,
  email?: string
): Promise<ToggleLikeResult> {
  if (isDbConfigured()) {
    const result = await toggleLikeWithGamification(productId, userId)
    return {
      liked: result.liked,
      likesCount: result.likesCount,
      qualifyingLikeCount: result.qualifyingLikeCount,
      qualifyingLikeTarget: result.qualifyingLikeTarget,
      pointLimitReached: result.pointLimitReached,
      canEarnLikeProgress: result.canEarnLikeProgress,
      windowResetsAt: result.windowResetsAt,
      dailyBonusQueued: result.dailyBonusQueued,
      dailyLikeCount: result.qualifyingLikeCount,
      dailyLikeTarget: result.qualifyingLikeTarget,
    }
  }
  const fileResult = fileToggleLike(productId, userId, email)
  const { devOnLikeToggle } = await import('@/lib/dev-gamification')
  const gam = devOnLikeToggle(userId, productId, fileResult.liked)
  return { ...fileResult, ...gam }
}

/** User összes kedvenc termék id-ja (privát wishlist). */
export async function getLikedProductIdsByUser(userId: string, email?: string): Promise<string[]> {
  if (isDbConfigured()) {
    const rows = await prisma.productLike.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => r.productId)
  }
  return fileGetLikedProductIdsByUser(userId, email)
}
