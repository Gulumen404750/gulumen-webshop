/**
 * Atomi készletkezelés – TOCTOU / oversell védelem.
 * stock < 0 = végtelen (nem csökkentünk).
 * UPDATE ... WHERE stock < 0 OR stock >= qty; 0 sor → OutOfStockException.
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
 * Atomian csökkenti a korlátozott készletet.
 * Végtelen stock (< 0) érintetlen marad.
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
      SET
        stock = CASE WHEN stock < 0 THEN stock ELSE stock - ${qty} END,
        "updatedAt" = NOW()
      WHERE id = ${productId}
        AND (stock < 0 OR stock >= ${qty})
    `
    if (Number(updated) === 0) {
      throw new OutOfStockException(productId)
    }
  }
}

/** Készlet visszaírása (csak ha stock >= 0 volt / korlátozott). */
export async function restoreStockAtomic(
  items: StockItem[],
  tx: TxClient = prisma
): Promise<void> {
  if (!isDbConfigured()) return
  for (const { productId, qty } of items) {
    if (qty < 1) continue
    await tx.$executeRaw`
      UPDATE "Product"
      SET
        stock = CASE WHEN stock < 0 THEN stock ELSE stock + ${qty} END,
        "updatedAt" = NOW()
      WHERE id = ${productId}
    `
  }
}
