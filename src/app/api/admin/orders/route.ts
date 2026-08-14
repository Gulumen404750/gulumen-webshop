import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { requireAdminPermission } from '@/lib/admin-auth'
import { redactCustomerPii, roleHasPermission } from '@/lib/admin-rbac'

/**
 * GET /api/admin/orders
 * Query: status, limit. List orders for admin.
 */
export async function GET(request: Request) {
  const gate = await requireAdminPermission('orders:read')
  if (!gate.ok) return gate.response
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
    orders: orders.map((o) => {
      const row = {
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
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        shippingPostalCode: o.shippingPostalCode,
        shippingCity: o.shippingCity,
        shippingStreet: o.shippingStreet,
        shippingHouseNumber: o.shippingHouseNumber,
        deliveryNotes: o.deliveryNotes,
        addressType: o.addressType,
        paidAt: o.paidAt?.toISOString(),
        printedAt: o.printedAt?.toISOString() ?? null,
        amountPaid: o.amountPaid,
        items: o.items,
      }
      return redactCustomerPii(
        row,
        roleHasPermission(gate.actor.role, 'customers:pii')
      )
    }),
  })
}
