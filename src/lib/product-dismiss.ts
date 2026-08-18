/**
 * Explicit kedvencek-törlés / unlike feketelista.
 * Ajánló és auto-kedvenc soha nem rakja vissza ezeket a termékeket.
 */
import path from 'path'
import fs from 'fs'
import { isDbConfigured, prisma } from '@/lib/prisma'

const DATA_DIR = path.join(process.cwd(), 'data')
const DISMISS_FILE = path.join(DATA_DIR, 'product-dismisses.json')

export type ProductDismissRecord = {
  productId: string
  userId: string
  createdAt: string
}

function loadRecords(): ProductDismissRecord[] {
  try {
    if (fs.existsSync(DISMISS_FILE)) {
      const raw = fs.readFileSync(DISMISS_FILE, 'utf-8')
      const data = JSON.parse(raw)
      const arr = Array.isArray(data) ? data : []
      return arr.filter(
        (r): r is ProductDismissRecord =>
          typeof r?.productId === 'string' &&
          typeof r?.userId === 'string' &&
          typeof r?.createdAt === 'string'
      )
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveRecords(records: ProductDismissRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DISMISS_FILE, JSON.stringify(records, null, 0), 'utf-8')
  } catch {
    /* read-only */
  }
}

export async function getDismissedProductIdsByUser(userId: string): Promise<string[]> {
  if (!userId) return []
  if (isDbConfigured()) {
    const rows = await prisma.productDismiss.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => r.productId)
  }
  return Array.from(
    new Set(loadRecords().filter((r) => r.userId === userId).map((r) => r.productId))
  )
}

export async function rememberProductDismiss(userId: string, productId: string): Promise<void> {
  if (!userId || !productId) return
  if (isDbConfigured()) {
    await prisma.productDismiss.upsert({
      where: { productId_userId: { productId, userId } },
      create: { productId, userId },
      update: {},
    })
    return
  }
  const records = loadRecords()
  if (records.some((r) => r.productId === productId && r.userId === userId)) return
  records.push({ productId, userId, createdAt: new Date().toISOString() })
  saveRecords(records)
}

export async function forgetProductDismiss(userId: string, productId: string): Promise<void> {
  if (!userId || !productId) return
  if (isDbConfigured()) {
    await prisma.productDismiss.deleteMany({ where: { productId, userId } })
    return
  }
  saveRecords(loadRecords().filter((r) => !(r.productId === productId && r.userId === userId)))
}
