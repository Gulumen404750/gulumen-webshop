import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/prisma'
import { requireAdminPermission } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { getOrderById, updateOrderCustomerDetails } from '@/lib/orders'
import { logger } from '@/lib/logger'

function optionalString(value: unknown, max = 200): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/**
 * PATCH /api/admin/orders/:id
 * Vevő / szállítási / számlázási adatok szerkesztése csomagolás előtt.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('orders:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  const existing = await getOrderById(id)
  if (!existing) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
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

  const emailRaw = optionalString(o.customerEmail, 254)
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: 'Érvénytelen e-mail cím' }, { status: 400 })
  }

  const patch = {
    customerName: optionalString(o.customerName, 120),
    customerPhone: optionalString(o.customerPhone, 40),
    customerEmail: emailRaw,
    shippingPostalCode: optionalString(o.shippingPostalCode, 16),
    shippingCity: optionalString(o.shippingCity, 80),
    shippingStreet: optionalString(o.shippingStreet, 120),
    shippingHouseNumber: optionalString(o.shippingHouseNumber, 40),
    billingSameAsShipping:
      typeof o.billingSameAsShipping === 'boolean' ? o.billingSameAsShipping : undefined,
    billingPostalCode: optionalString(o.billingPostalCode, 16),
    billingCity: optionalString(o.billingCity, 80),
    billingStreet: optionalString(o.billingStreet, 120),
    billingHouseNumber: optionalString(o.billingHouseNumber, 40),
    deliveryNotes: optionalString(o.deliveryNotes, 1000),
  }

  const hasAny = Object.values(patch).some((v) => v !== undefined)
  if (!hasAny) {
    return NextResponse.json({ error: 'Nincs módosítható mező' }, { status: 400 })
  }

  try {
    const updated = await updateOrderCustomerDetails(id, patch)
    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    await logAdminAction({
      action: 'order_customer_update',
      orderId: id,
      success: true,
      request,
      details: {
        fields: Object.keys(patch).filter((k) => (patch as Record<string, unknown>)[k] !== undefined),
      },
    })
    logger.info({ orderId: id }, 'admin/orders PATCH customer details')
    return NextResponse.json({ ok: true, order: updated })
  } catch (err) {
    logger.error({ err, orderId: id }, 'admin/orders PATCH failed')
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}
