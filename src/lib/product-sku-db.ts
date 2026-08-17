import { prisma, isDbConfigured } from '@/lib/prisma'
import { nextGeneratedSku } from '@/lib/product-sku'

export async function allocateNextProductSku(): Promise<string> {
  if (!isDbConfigured()) return nextGeneratedSku([])
  const rows = await prisma.product.findMany({
    where: { sku: { startsWith: 'GUL-' } },
    select: { sku: true },
  })
  return nextGeneratedSku(rows.map((row) => row.sku))
}

export function isSkuUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; meta?: { target?: unknown } }
  if (e.code !== 'P2002') return false
  const target = e.meta?.target
  if (typeof target === 'string') return target.includes('sku')
  if (Array.isArray(target)) return target.some((t) => String(t).includes('sku'))
  return false
}
