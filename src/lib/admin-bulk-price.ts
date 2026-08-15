/**
 * Tömeges ármódosítás végrehajtása – azonnali vagy approval után.
 */
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import { alertAdminAnomalySafe } from '@/lib/admin-anomaly-alert'
import type { AdminActor } from '@/lib/admin-rbac'
import type { BulkPricePayload } from '@/lib/admin-approval'

export function computeBulkNewPrices(
  currentHuf: number,
  currentEur: number,
  mode: 'fixed' | 'percent',
  priceHuf?: number,
  percentChange?: number
): { priceHuf: number; priceEur: number } {
  let newHuf: number
  if (mode === 'fixed') {
    newHuf = priceHuf!
  } else {
    newHuf = Math.max(0, Math.round(currentHuf * (1 + percentChange! / 100)))
  }
  const ratio = currentHuf > 0 ? currentEur / currentHuf : 0
  const newEur = Math.max(0, Math.round(newHuf * ratio))
  return { priceHuf: newHuf, priceEur: newEur }
}

export async function executeBulkPrice(opts: {
  ids: string[]
  mode: 'fixed' | 'percent'
  priceHuf?: number
  percentChange?: number
  actor: AdminActor
  request?: Request
}): Promise<{ updated: number; missingIds: string[]; mode: 'fixed' | 'percent' }> {
  const ids = [...new Set(opts.ids.filter(Boolean))]
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, priceHuf: true, priceEur: true },
  })

  const foundIds = new Set(products.map((p) => p.id))
  const missingIds = ids.filter((id) => !foundIds.has(id))

  if (products.length === 0) {
    return { updated: 0, missingIds, mode: opts.mode }
  }

  await prisma.$transaction(
    products.map((product) => {
      const prices = computeBulkNewPrices(
        product.priceHuf,
        product.priceEur,
        opts.mode,
        opts.priceHuf,
        opts.percentChange
      )
      return prisma.product.update({
        where: { id: product.id },
        data: prices,
      })
    })
  )

  await logAdminAction({
    action: 'product_bulk_price',
    success: true,
    request: opts.request,
    actor: opts.actor,
    details: {
      updated: products.length,
      missingIds,
      mode: opts.mode,
      percentChange: opts.percentChange,
      priceHuf: opts.priceHuf,
    },
  })
  if (opts.request) {
    await alertAdminAnomalySafe({
      kind: 'bulk_price',
      count: products.length,
      request: opts.request,
      details: { mode: opts.mode, percentChange: opts.percentChange, priceHuf: opts.priceHuf },
    })
  }

  return { updated: products.length, missingIds, mode: opts.mode }
}

export async function executeBulkPriceFromPayload(opts: {
  payload: BulkPricePayload
  actor: AdminActor
  request?: Request
}): Promise<{ updated: number; missingIds: string[]; mode: 'fixed' | 'percent' }> {
  return executeBulkPrice({
    ids: opts.payload.ids,
    mode: opts.payload.mode,
    priceHuf: opts.payload.priceHuf,
    percentChange: opts.payload.percentChange,
    actor: opts.actor,
    request: opts.request,
  })
}
