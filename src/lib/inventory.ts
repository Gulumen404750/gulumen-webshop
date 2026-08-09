/**
 * Atomi készletkezelés – TOCTOU / oversell védelem.
 * UPDATE ... WHERE stock >= qty; 0 sor → OutOfStockException.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'

export class OutOfStockException extends Error {
  constructor(public productId: string) {
    super('Out of stock')
    this.name = 'OutOfStockException'
  }
}

export type StockItem = { productId: string; qty: number }

type TxClient = {
  $executeRaw: typeof prisma.$executeRaw
}

/**
 * Atomian csökkenti a készletet. Ha bármelyik terméknél nincs elég stock,
 * OutOfStockException-t dob (a tranzakció rollbackel).
 */
export async function decrementStockAtomic(
  items: StockItem[],
  tx: TxClient = prisma
): Promise<void> {
  if (!isDbConfigured()) return
  for (const { productId, qty } of items) {
    if (qty < 1) continue
    const updated = await tx.$executeRaw`
      UPDATE "Product"
      SET stock = stock - ${qty}, "updatedAt" = NOW()
      WHERE id = ${productId} AND stock >= ${qty}
    `
    if (Number(updated) === 0) {
      throw new OutOfStockException(productId)
    }
  }
}

/** Készlet visszaírása (pl. elakadt payment_pending cancel után). */
export async function restoreStockAtomic(
  items: StockItem[],
  tx: TxClient = prisma
): Promise<void> {
  if (!isDbConfigured()) return
  for (const { productId, qty } of items) {
    if (qty < 1) continue
    await tx.$executeRaw`
      UPDATE "Product"
      SET stock = stock + ${qty}, "updatedAt" = NOW()
      WHERE id = ${productId}
    `
  }
}
