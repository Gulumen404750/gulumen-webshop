/**
 * Bulk törlés végrehajtása (products / users / coupons) – approval után is innen.
 */
import { prisma } from '@/lib/prisma'
import { revalidateShopProducts } from '@/lib/revalidate-shop'
import type { BulkDeleteResource } from '@/lib/admin-approval'
import { logAdminAction } from '@/lib/admin-audit'
import type { AdminActor } from '@/lib/admin-rbac'
import { alertBulkDeleteIfAnomalousSafe } from '@/lib/admin-anomaly-alert'

export async function executeBulkDelete(opts: {
  resource: BulkDeleteResource
  ids: string[]
  actor: AdminActor
  request?: Request
}): Promise<{ deleted: number; missing: number }> {
  const ids = [...new Set(opts.ids.filter(Boolean))]
  if (ids.length === 0) return { deleted: 0, missing: 0 }

  if (opts.resource === 'products') {
    const existing = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true },
    })
    const foundIds = existing.map((p) => p.id)
    if (foundIds.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: foundIds } } })
      for (const p of existing) {
        revalidateShopProducts(p.slug)
      }
    }
    await logAdminAction({
      action: 'product_bulk_delete',
      success: true,
      request: opts.request,
      actor: opts.actor,
      details: { count: foundIds.length, ids: foundIds },
    })
    if (opts.request) await alertBulkDeleteIfAnomalousSafe(opts.request)
    return { deleted: foundIds.length, missing: ids.length - foundIds.length }
  }

  if (opts.resource === 'users') {
    const existing = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })
    const foundIds = existing.map((u) => u.id)
    if (foundIds.length > 0) {
      // Rendelések detach (ugyanaz a minta, mint a single delete)
      await prisma.order.updateMany({
        where: { userId: { in: foundIds } },
        data: { userId: null },
      })
      await prisma.user.deleteMany({ where: { id: { in: foundIds } } })
    }
    await logAdminAction({
      action: 'user_bulk_delete',
      success: true,
      request: opts.request,
      actor: opts.actor,
      details: { count: foundIds.length, ids: foundIds },
    })
    if (opts.request) await alertBulkDeleteIfAnomalousSafe(opts.request)
    return { deleted: foundIds.length, missing: ids.length - foundIds.length }
  }

  // coupons – soft delete
  const existing = await prisma.coupon.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })
  const foundIds = existing.map((c) => c.id)
  if (foundIds.length > 0) {
    await prisma.coupon.updateMany({
      where: { id: { in: foundIds } },
      data: { active: false },
    })
  }
  await logAdminAction({
    action: 'coupon_bulk_delete',
    success: true,
    request: opts.request,
    actor: opts.actor,
    details: { count: foundIds.length, ids: foundIds },
  })
  if (opts.request) await alertBulkDeleteIfAnomalousSafe(opts.request)
  return { deleted: foundIds.length, missing: ids.length - foundIds.length }
}
