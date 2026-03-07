import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/orders
 * Query: status, limit. List orders for admin.
 */
export async function GET(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')?.trim() || ''
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 200)

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { items: true },
  })

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      orderGroupId: o.orderGroupId,
      orderType: o.orderType,
      subtotalHuf: o.subtotalHuf,
      discountHuf: o.discountHuf,
      totalHuf: o.totalHuf,
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      customerEmail: o.customerEmail,
      paidAt: o.paidAt?.toISOString(),
      amountPaid: o.amountPaid,
      items: o.items,
    })),
  })
}
