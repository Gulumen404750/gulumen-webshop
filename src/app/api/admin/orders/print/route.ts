import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { logger } from '@/lib/logger'

const MAX_BULK = 50

/**
 * POST /api/admin/orders/print
 * Body: { ids: string[] }
 * Tömeges címkenyomtatás jelölés → printedAt = now (idempotens, meglévő printedAt megmarad).
 */
export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const idsRaw = (body as { ids?: unknown })?.ids
  if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const ids = [
    ...new Set(
      idsRaw
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ].slice(0, MAX_BULK)

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const now = new Date()
  const result = await prisma.order.updateMany({
    where: {
      id: { in: ids },
      printedAt: null,
    },
    data: { printedAt: now },
  })

  await logAdminAction({
    action: 'order_label_print_bulk',
    orderId: ids[0],
    success: true,
    details: `ids=${ids.length}; newlyPrinted=${result.count}`,
  })
  logger.debug({ count: ids.length, newlyPrinted: result.count }, 'admin/orders/print bulk')

  const printedAt = now.toISOString()
  return NextResponse.json({
    success: true,
    ids,
    newlyPrinted: result.count,
    printedAt,
  })
}
