import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { sendAbandonedCartReminder } from '@/lib/cart-snapshot'
import { isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * POST /api/admin/abandoned-carts/[userId]/remind
 * Alap rendszer-emlékeztető e-mail a kosár e-mail címére (kupon nélkül).
 */
export async function POST(request: Request, context: RouteContext) {
  const gate = await requireAdminPermission('support:write')
  if (!gate.ok) return gate.response

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const result = await sendAbandonedCartReminder(userId)
  if (!result.ok) {
    await logAdminAction({
      action: 'abandoned_cart_remind',
      success: false,
      request,
      details: { userId, error: result.error },
    })
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  await logAdminAction({
    action: 'abandoned_cart_remind',
    success: true,
    request,
    details: { userId, emailSent: result.emailSent },
  })

  return NextResponse.json({
    ok: true,
    emailSent: result.emailSent,
    to: result.to,
  })
}
