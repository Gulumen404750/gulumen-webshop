import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { sendAbandonedCartReminder } from '@/lib/cart-snapshot'
import { isDbConfigured } from '@/lib/prisma'

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * POST /api/admin/abandoned-carts/[userId]/remind
 * Alap rendszer-emlékeztető e-mail a kosár e-mail címére (kupon nélkül).
 */
export async function POST(_request: Request, context: RouteContext) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const result = await sendAbandonedCartReminder(userId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    emailSent: result.emailSent,
    to: result.to,
  })
}
