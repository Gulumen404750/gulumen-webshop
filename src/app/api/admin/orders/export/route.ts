import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import { alertAdminAnomalySafe } from '@/lib/admin-anomaly-alert'
import { buildProductionJobPayload } from '@/lib/production-payload'

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildOrdersCsv(
  rows: {
    id: string
    createdAt: Date
    customerEmail: string | null
    status: string
    totalHuf: number
    orderType: string | null
  }[]
): string {
  const header = ['id', 'dátum', 'email', 'státusz', 'összeg', 'típus']
  const lines = [
    header.join(','),
    ...rows.map((o) =>
      [
        escapeCsvField(o.id),
        escapeCsvField(o.createdAt.toISOString()),
        escapeCsvField(o.customerEmail ?? ''),
        escapeCsvField(o.status),
        escapeCsvField(String(o.totalHuf)),
        escapeCsvField(o.orderType ?? ''),
      ].join(',')
    ),
  ]
  return `\uFEFF${lines.join('\r\n')}`
}

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
      customerEmail: true,
      status: true,
      totalHuf: true,
      orderType: true,
    },
  })

  const csv = buildOrdersCsv(orders)
  const filename = `rendelesek-${new Date().toISOString().slice(0, 10)}.csv`

  await logAdminAction({
    action: 'orders_csv_export',
    success: true,
    request,
    details: { count: orders.length, status: status || null, filename, capped: orders.length >= 5000 },
  })
  await alertAdminAnomalySafe({
    kind: 'csv_export',
    count: orders.length,
    request,
    details: { filename, status: status || null },
  })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
