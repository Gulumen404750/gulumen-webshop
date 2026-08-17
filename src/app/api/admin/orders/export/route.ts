import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import { alertAdminAnomalySafe } from '@/lib/admin-anomaly-alert'
import { buildProductionJobPayload } from '@/lib/production-payload'
import { buildOrdersCsv, encodeCsvUtf8Bom } from '@/lib/orders-csv'

/**
 * GET /api/admin/orders/export?format=csv|production
 * Query: format, status (opcionális szűrő).
 * production: JSON gyártási csomag (SKU, qty, paraméterek) a 3D farm / AI számára.
 */
export async function GET(request: Request) {
  const gate = await requireAdminPermission('orders:export')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')?.trim().toLowerCase()
  if (format !== 'csv' && format !== 'production') {
    return NextResponse.json(
      { error: 'Unsupported format. Use format=csv or format=production' },
      { status: 400 }
    )
  }

  const status = searchParams.get('status')?.trim() || ''
  const where: Record<string, unknown> = {}
  if (status) where.status = status

  if (format === 'production') {
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: { items: true },
    })
    const jobs = orders.map((order) =>
      buildProductionJobPayload({
        orderId: order.id,
        orderGroupId: order.orderGroupId,
        status: order.status,
        paidAt: order.paidAt?.toISOString() ?? null,
        items: order.items,
      })
    )
    const filename = `gyartas-${new Date().toISOString().slice(0, 10)}.json`

    await logAdminAction({
      action: 'orders_production_export',
      success: true,
      request,
      details: { count: jobs.length, status: status || null, filename, capped: jobs.length >= 5000 },
    })
    await alertAdminAnomalySafe({
      kind: 'csv_export',
      count: jobs.length,
      request,
      details: { filename, status: status || null },
    })

    return new NextResponse(JSON.stringify({ jobs }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      id: true,
      createdAt: true,
      customerName: true,
      customerEmail: true,
      status: true,
      orderType: true,
      items: {
        select: {
          name: true,
          sku: true,
          qty: true,
          priceHuf: true,
          fulfillmentType: true,
          parameters: true,
        },
      },
    },
  })

  const csv = buildOrdersCsv(orders)
  const lineCount = Math.max(0, csv.split('\r\n').length - 1)
  const filename = `rendelesek-${new Date().toISOString().slice(0, 10)}.csv`

  await logAdminAction({
    action: 'orders_csv_export',
    success: true,
    request,
    details: {
      count: lineCount,
      orderCount: orders.length,
      status: status || null,
      filename,
      capped: orders.length >= 5000,
    },
  })
  await alertAdminAnomalySafe({
    kind: 'csv_export',
    count: lineCount,
    request,
    details: { filename, status: status || null, orderCount: orders.length },
  })

  return new NextResponse(Buffer.from(encodeCsvUtf8Bom(csv)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
