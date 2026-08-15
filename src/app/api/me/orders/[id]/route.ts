import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { getOrderById } from '@/lib/orders'
import { canCustomerEditShippingAddress, hasShippingAddressChanged } from '@/lib/order-shipping-edit'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/me/orders/:id – egy saját rendelés részletei (címmódosító oldalhoz).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limitResult = await rateLimit(request)
  if (!limitResult.ok) {
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429 }
    )
  }

  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Order id required' }, { status: 400 })
  }

  const order = await getOrderById(id)
  if (!order || order.userId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const editGate = canCustomerEditShippingAddress(order)

  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      orderType: order.orderType ?? null,
      createdAt: order.createdAt,
      totalHuf: order.totalHuf,
      customerName: order.customerName ?? null,
      customerEmail: order.customerEmail ?? null,
      customerPhone: order.customerPhone ?? null,
      shipping: {
        postalCode: order.shippingPostalCode ?? '',
        city: order.shippingCity ?? '',
        street: order.shippingStreet ?? '',
        houseNumber: order.shippingHouseNumber ?? '',
      },
      deliveryNotes: order.deliveryNotes ?? null,
      printedAt: order.printedAt ?? null,
      shippingAddressChangedAt: order.shippingAddressChangedAt ?? null,
      addressChanged: hasShippingAddressChanged(order.shippingAddressChangedAt),
      canEditShipping: editGate.ok,
      canEditReason: editGate.ok ? null : editGate.reason,
    },
  })
}
