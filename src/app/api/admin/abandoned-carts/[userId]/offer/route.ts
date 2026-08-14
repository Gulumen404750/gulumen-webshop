import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import {
  sendAbandonedCartOffer,
  ABANDONED_CART_OFFER_PERCENTS,
  type AbandonedCartOfferPercent,
} from '@/lib/cart-snapshot'
import { isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'

const offerSchema = z.object({
  percent: z.number().int(),
})

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * POST /api/admin/abandoned-carts/[userId]/offer
 * Személyes kedvezmény kupon + e-mail a kosár tartalmára.
 */
export async function POST(request: Request, context: RouteContext) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = offerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const percent = parsed.data.percent as AbandonedCartOfferPercent
  if (!ABANDONED_CART_OFFER_PERCENTS.includes(percent)) {
    return NextResponse.json(
      { error: `Percent must be one of: ${ABANDONED_CART_OFFER_PERCENTS.join(', ')}` },
      { status: 400 }
    )
  }

  const result = await sendAbandonedCartOffer(userId, percent)
  if (!result.ok) {
    await logAdminAction({
      action: 'abandoned_cart_offer',
      success: false,
      request,
      details: { userId, percent, error: result.error },
    })
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  await logAdminAction({
    action: 'abandoned_cart_offer',
    success: true,
    request,
    details: { userId, percent, emailSent: result.emailSent },
  })

  return NextResponse.json({
    ok: true,
    couponCode: result.couponCode,
    emailSent: result.emailSent,
    emailError: result.emailError,
    percent,
  })
}
