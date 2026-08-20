import { prisma, isDbConfigured } from '@/lib/prisma'

/** Sikeres / folyamatban lévő fizetett rendelések – ezeken számoljuk a spórolást. */
export const LIFETIME_SAVINGS_STATUSES = ['paid', 'sourcing_pending', 'fulfilled'] as const

export function isLifetimeSavingsStatus(status: string): boolean {
  return (LIFETIME_SAVINGS_STATUSES as readonly string[]).includes(status)
}

export function savingsHufFromOrder(order: {
  discountHuf?: number | null
  pointsDiscountHuf?: number | null
}): number {
  const discount = Math.max(0, Math.floor(Number(order.discountHuf) || 0))
  const points = Math.max(0, Math.floor(Number(order.pointsDiscountHuf) || 0))
  return discount + points
}

export function sumLifetimeSavingsHuf(
  orders: Array<{
    status?: string | null
    discountHuf?: number | null
    pointsDiscountHuf?: number | null
  }>
): number {
  return orders.reduce((sum, order) => {
    if (!isLifetimeSavingsStatus(String(order.status ?? ''))) return sum
    return sum + savingsHufFromOrder(order)
  }, 0)
}

/** Összes megspórolt Ft: kupon + hűség (+ Szerencsekerék a discountHuf-ban) + belső pontok. */
export async function getUserLifetimeSavingsHuf(userId: string): Promise<number> {
  const key = userId.trim()
  if (!key) return 0

  if (isDbConfigured()) {
    try {
      const agg = await prisma.order.aggregate({
        where: { userId: key, status: { in: [...LIFETIME_SAVINGS_STATUSES] } },
        _sum: { discountHuf: true, pointsDiscountHuf: true },
      })
      return Math.max(
        0,
        (agg._sum.discountHuf ?? 0) + (agg._sum.pointsDiscountHuf ?? 0)
      )
    } catch {
      /* JSON fallback */
    }
  }

  const { getOrdersByUserId } = await import('@/lib/orders')
  const orders = await getOrdersByUserId(key, { limit: 100 })
  return sumLifetimeSavingsHuf(orders)
}
