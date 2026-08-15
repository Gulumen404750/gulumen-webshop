import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { getOrderById, updateOrderShippingByCustomer } from '@/lib/orders'
import { sendAdminAddressChangeNotification } from '@/lib/order-email'
import { canCustomerEditShippingAddress } from '@/lib/order-shipping-edit'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import { logger } from '@/lib/logger'

function optionalString(value: unknown, max = 200): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function requiredString(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/**
 * PATCH /api/me/orders/:id/shipping
 * Bejelentkezett vásárló szállítási cím módosítása (amíg nincs feladva / nyomtatva).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limitResult = await rateLimit(request, { maxPerWindow: 20, windowMs: 60_000 })
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const o = body as Record<string, unknown>

  const shippingPostalCode = requiredString(o.shippingPostalCode, 16)
  const shippingCity = requiredString(o.shippingCity, 80)
  const shippingStreet = requiredString(o.shippingStreet, 120)
  const shippingHouseNumber = requiredString(o.shippingHouseNumber, 40)
  if (!shippingPostalCode || !shippingCity || !shippingStreet || !shippingHouseNumber) {
    return NextResponse.json(
      { error: 'Add meg a teljes szállítási címet (irányítószám, város, utca, házszám).' },
      { status: 400 }
    )
  }

  const before = await getOrderById(id)
  if (!before) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const result = await updateOrderShippingByCustomer(id, userId, {
    customerName: optionalString(o.customerName, 120),
    customerPhone: optionalString(o.customerPhone, 40),
    shippingPostalCode,
    shippingCity,
    shippingStreet,
    shippingHouseNumber,
    deliveryNotes: optionalString(o.deliveryNotes, 1000),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const changedFields = [
    'customerName',
    'customerPhone',
    'shippingPostalCode',
    'shippingCity',
    'shippingStreet',
    'shippingHouseNumber',
    'deliveryNotes',
  ]

  try {
    await sendAdminAddressChangeNotification({
      orderId: id,
      before,
      after: result.order,
      changedFields,
      source: 'customer',
    })
  } catch (err) {
    logger.error({ err, orderId: id }, 'me/orders shipping notify failed')
  }

  logger.info({ orderId: id, userId }, 'customer shipping address updated')

  return NextResponse.json({
    ok: true,
    order: {
      id: result.order.id,
      status: result.order.status,
      customerName: result.order.customerName ?? null,
      customerPhone: result.order.customerPhone ?? null,
      shipping: {
        postalCode: result.order.shippingPostalCode ?? '',
        city: result.order.shippingCity ?? '',
        street: result.order.shippingStreet ?? '',
        houseNumber: result.order.shippingHouseNumber ?? '',
      },
      deliveryNotes: result.order.deliveryNotes ?? null,
      shippingAddressChangedAt: result.order.shippingAddressChangedAt ?? null,
      canEditShipping: canCustomerEditShippingAddress(result.order).ok,
    },
  })
}
