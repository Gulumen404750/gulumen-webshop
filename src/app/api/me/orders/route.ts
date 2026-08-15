import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { getOrdersByUserId } from '@/lib/orders'
import { canCustomerEditShippingAddress, hasShippingAddressChanged } from '@/lib/order-shipping-edit'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/me/orders – bejelentkezett felhasználó rendeléstörténete.
 */
export async function GET(request: Request) {
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
    return NextResponse.json({ orders: [] })
  }

  const url = new URL(request.url)
  const limitRaw = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50

  const orders = await getOrdersByUserId(userId, { limit })

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      orderType: order.orderType ?? null,
      orderGroupId: order.orderGroupId ?? null,
      createdAt: order.createdAt,
      totalHuf: order.totalHuf,
      subtotalHuf: order.subtotalHuf,
      discountHuf: order.discountHuf,
      currency: order.currency,
      customerName: order.customerName ?? null,
      customerEmail: order.customerEmail ?? null,
      customerPhone: order.customerPhone ?? null,
      shipping: order.shippingCity
        ? {
            postalCode: order.shippingPostalCode ?? '',
            city: order.shippingCity,
            street: order.shippingStreet ?? '',
            houseNumber: order.shippingHouseNumber ?? '',
          }
        : null,
      deliveryNotes: order.deliveryNotes ?? null,
      billingSameAsShipping: order.billingSameAsShipping ?? true,
      billing:
        order.billingSameAsShipping === false && order.billingCity
          ? {
              postalCode: order.billingPostalCode ?? '',
              city: order.billingCity,
              street: order.billingStreet ?? '',
              houseNumber: order.billingHouseNumber ?? '',
            }
          : null,
      items: order.items.map((item) => ({
        productId: item.productId,
        name: item.name ?? null,
        qty: item.qty,
        priceHuf: item.priceHuf,
        fulfillmentType: item.fulfillmentType,
      })),
      paidAt: order.paidAt ?? null,
      printedAt: order.printedAt ?? null,
      shippingAddressChangedAt: order.shippingAddressChangedAt ?? null,
      addressChanged: hasShippingAddressChanged(order.shippingAddressChangedAt),
      canEditShipping: canCustomerEditShippingAddress(order).ok,
    })),
  })
}
