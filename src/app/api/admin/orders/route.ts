import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { requireAdminPermission } from '@/lib/admin-auth'
import { roleHasPermission } from '@/lib/admin-rbac'

/**
 * GET /api/admin/orders
 * Query: status, limit. List orders for admin.
 */
export async function GET(request: Request) {
  const auth = await requireAdminPermission('orders:read')
  if (!auth.ok) return auth.response
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

  const canSeePii = roleHasPermission(auth.actor.role, 'customers:pii')

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
      customerEmail: canSeePii ? o.customerEmail : null,
      customerName: canSeePii ? o.customerName : null,
      customerPhone: canSeePii ? o.customerPhone : null,
      shippingPostalCode: canSeePii ? o.shippingPostalCode : null,
      shippingCity: canSeePii ? o.shippingCity : null,
      shippingStreet: canSeePii ? o.shippingStreet : null,
      shippingHouseNumber: canSeePii ? o.shippingHouseNumber : null,
      deliveryNotes: canSeePii ? o.deliveryNotes : null,
      addressType: o.addressType,
      paidAt: o.paidAt?.toISOString(),
      printedAt: o.printedAt?.toISOString() ?? null,
      amountPaid: o.amountPaid,
      items: o.items,
    })),
  })
}
