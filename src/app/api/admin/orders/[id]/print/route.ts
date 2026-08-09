import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/orders/:id/print
 * Jelzi, hogy a szállítási címke kinyomtatásra került → printedAt = now (idempotens).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  const existing = await prisma.order.findUnique({
    where: { id },
    select: { id: true, printedAt: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (existing.printedAt) {
    return NextResponse.json({
      success: true,
      orderId: id,
      printedAt: existing.printedAt.toISOString(),
      alreadyPrinted: true,
    })
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { printedAt: new Date() },
    select: { printedAt: true },
  })

  await logAdminAction({ action: 'order_label_print', orderId: id, success: true })
  logger.debug({ orderId: id }, 'admin/orders/print marked printed')

  return NextResponse.json({
    success: true,
    orderId: id,
    printedAt: updated.printedAt!.toISOString(),
    alreadyPrinted: false,
  })
}
