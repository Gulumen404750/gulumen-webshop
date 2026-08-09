import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'

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
 * GET /api/admin/orders/export?format=csv
 * Query: format=csv, status (opcionális szűrő).
 */
export async function GET(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')?.trim().toLowerCase()
  if (format !== 'csv') {
    return NextResponse.json({ error: 'Unsupported format. Use format=csv' }, { status: 400 })
  }

  const status = searchParams.get('status')?.trim() || ''
  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
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

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
