import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/prisma'
import { requireAdminPermission } from '@/lib/admin-auth'
import { getOrderById } from '@/lib/orders'
import { buildProductionJobPayload } from '@/lib/production-payload'
import { dispatchProductionJobForPaidOrder } from '@/lib/production-dispatch'

/**
 * GET /api/admin/orders/:id/production
 * Gyártási JSON (SKU, darabszám, egyedi paraméterek) a 3D farm / AI számára.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('orders:read')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Order id required' }, { status: 400 })
  }

  const order = await getOrderById(id)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const payload = buildProductionJobPayload({
    orderId: order.id,
    orderGroupId: order.orderGroupId,
    status: order.status,
    paidAt: order.paidAt ?? null,
    items: order.items,
  })
  return NextResponse.json({
    production: payload,
    ...(payload.receptek.length === 1 ? { termek: payload.receptek[0]?.termek } : {}),
    rendeles_azonosito: payload.rendeles_azonosito,
    termekek: payload.termekek,
    receptek: payload.receptek,
  })
}

/**
 * POST /api/admin/orders/:id/production
 * Újra elküldi a gyártási webhookot (SKU backfill-lel).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('orders:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Order id required' }, { status: 400 })
  }

  const payload = await dispatchProductionJobForPaidOrder(id)
  if (!payload) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    production: payload,
    ...(payload.receptek.length === 1 ? { termek: payload.receptek[0]?.termek } : {}),
    rendeles_azonosito: payload.rendeles_azonosito,
    termekek: payload.termekek,
    receptek: payload.receptek,
  })
}
