import { NextResponse } from 'next/server'
import {
  getOrderByShippingEditToken,
  updateOrderShippingByToken,
  ensureShippingEditToken,
} from '@/lib/orders'
import { sendAdminAddressChangeNotification } from '@/lib/order-email'
import { canCustomerEditShippingAddress, hasShippingAddressChanged } from '@/lib/order-shipping-edit'
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

function orderPayload(order: Awaited<ReturnType<typeof getOrderByShippingEditToken>>) {
  if (!order) return null
  const editGate = canCustomerEditShippingAddress(order)
  return {
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
  }
}

/**
 * GET /api/orders/:id/shipping-edit?t=TOKEN
 * Tokenes (e-mail CTA) rendelés adat – bejelentkezés nélkül.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limitResult = await rateLimit(request, { maxPerWindow: 40, windowMs: 60_000 })
  if (!limitResult.ok) {
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  const url = new URL(request.url)
  const token = url.searchParams.get('t')?.trim() || ''
  if (!id?.trim() || !token) {
    return NextResponse.json({ error: 'Hiányzó rendelés vagy token.' }, { status: 400 })
  }

  // Régi rendelések: token hiányzik → egyszeri ensure NEM a nyilvános GET-en (biztonság).
  const order = await getOrderByShippingEditToken(id, token)
  if (!order) {
    return NextResponse.json({ error: 'Érvénytelen vagy lejárt módosító link.' }, { status: 403 })
  }

  return NextResponse.json({ order: orderPayload(order) })
}

/**
 * PATCH /api/orders/:id/shipping-edit
 * Body: { t, customerName?, customerPhone?, shippingPostalCode, ... }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limitResult = await rateLimit(request, { maxPerWindow: 20, windowMs: 60_000 })
  if (!limitResult.ok) {
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 })
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
  const token = typeof o.t === 'string' ? o.t.trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'Hiányzó token.' }, { status: 400 })
  }

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

  const before = await getOrderByShippingEditToken(id, token)
  if (!before) {
    return NextResponse.json({ error: 'Érvénytelen vagy lejárt módosító link.' }, { status: 403 })
  }

  const result = await updateOrderShippingByToken(id, token, {
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

  try {
    await sendAdminAddressChangeNotification({
      orderId: id,
      before,
      after: result.order,
      changedFields: [
        'customerName',
        'customerPhone',
        'shippingPostalCode',
        'shippingCity',
        'shippingStreet',
        'shippingHouseNumber',
        'deliveryNotes',
      ],
      source: 'customer',
    })
  } catch (err) {
    logger.error({ err, orderId: id }, 'token shipping-edit notify failed')
  }

  // Token megújítás nem kell – ugyanaz a link újra használható amíg szerkeszthető.
  await ensureShippingEditToken(id)

  logger.info({ orderId: id }, 'customer shipping address updated via email token')

  return NextResponse.json({
    ok: true,
    order: orderPayload(result.order),
  })
}
