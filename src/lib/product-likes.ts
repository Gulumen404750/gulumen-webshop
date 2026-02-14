/**
 * ProductLike – userhez kötött kedvelések (privát), számláló publikus.
 * Unique: (productId, userId) → 1 user 1 like / termék.
 * Élesben: PostgreSQL/Redis ajánlott.
 */

import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const PRODUCT_LIKES_FILE = path.join(DATA_DIR, 'product-likes.json')

export type ProductLikeRecord = {
  productId: string
  userId: string
  createdAt: string
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

/** Nyilvános: termékre vonatkozó like-ok száma. */
export function getLikesCount(productId: string): number {
  const records = loadRecords()
  return records.filter((r) => r.productId === productId).length
}

/** User ezt a terméket kedveli-e (privát állapot). */
export function hasLike(productId: string, userId: string): boolean {
  const records = loadRecords()
  return records.some((r) => r.productId === productId && r.userId === userId)
}

/** Like hozzáadása (toggle on). Unique (productId, userId). */
export function addLike(productId: string, userId: string): void {
  const records = loadRecords()
  if (records.some((r) => r.productId === productId && r.userId === userId)) return
  records.push({ productId, userId, createdAt: new Date().toISOString() })
  saveRecords(records)
}

/** Like eltávolítása (toggle off). */
export function removeLike(productId: string, userId: string): void {
  const records = loadRecords().filter((r) => !(r.productId === productId && r.userId === userId))
  saveRecords(records)
}

/**
 * Toggle: ha van like, töröljük és false; ha nincs, hozzáadjuk és true.
 * Vissza: { liked: boolean, likesCount: number }
 */
export function toggleLike(productId: string, userId: string): { liked: boolean; likesCount: number } {
  const records = loadRecords()
  const idx = records.findIndex((r) => r.productId === productId && r.userId === userId)
  if (idx >= 0) {
    records.splice(idx, 1)
    saveRecords(records)
    return { liked: false, likesCount: records.filter((r) => r.productId === productId).length }
  }
  records.push({ productId, userId, createdAt: new Date().toISOString() })
  saveRecords(records)
  return { liked: true, likesCount: records.filter((r) => r.productId === productId).length }
}

/** User összes kedvenc termék id-ja (privát wishlist). */
export function getLikedProductIdsByUser(userId: string): string[] {
  const records = loadRecords()
  return Array.from(new Set(records.filter((r) => r.userId === userId).map((r) => r.productId)))
}
