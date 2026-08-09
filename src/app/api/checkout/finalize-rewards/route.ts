import { NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { getOrderById, getOrdersByGroupId, setOrderStatus } from '@/lib/orders'
import {
  confirmPendingAndFinalizeOrderGroup,
  finalizeOrderRewards,
} from '@/lib/checkout-rewards'
import { logger } from '@/lib/logger'

/**
 * POST /api/checkout/finalize-rewards
 * Siker oldal hívja: webhook mellett / helyett is érvényteleníti a kuponokat és levonja a pontokat.
 * order_group_id esetén a még payment_pending rendeléseket is lezárja (Dummy / pending checkout).
 * Idempotens.
 */
const bodySchema = z.object({
  sessionId: z.string().min(1).optional(),
  orderGroupId: z.string().min(1).optional(),
  orderId: z.string().min(1).optional(),
})

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const { sessionId, orderGroupId, orderId } = parsed.data
  if (!sessionId && !orderGroupId && !orderId) {
    return NextResponse.json(
      { error: 'sessionId, orderGroupId or orderId required' },
      { status: 400 }
    )
  }

  try {
    if (orderGroupId) {
      const orders = await getOrdersByGroupId(orderGroupId)
      if (!orders.length) return NextResponse.json({ error: 'Orders not found' }, { status: 404 })
      const results = await confirmPendingAndFinalizeOrderGroup(orderGroupId)
      return NextResponse.json({ ok: true, results })
    }

    if (orderId) {
      const order = await getOrderById(orderId)
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      if (order.orderGroupId) {
        const results = await confirmPendingAndFinalizeOrderGroup(order.orderGroupId)
        return NextResponse.json({ ok: true, results })
      }
      if (order.status === 'payment_pending') {
        await setOrderStatus(
          orderId,
          order.orderType === 'sourcing' ? 'sourcing_pending' : 'paid'
        )
      }
      const result = await finalizeOrderRewards(orderId)
      return NextResponse.json({ ok: true, results: [result] })
    }

    if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const metaOrderId = session.metadata?.orderId
    const metaGroupId = session.metadata?.orderGroupId

    if (metaGroupId) {
      // Stripe csoport: ne confirmáljuk a pendinget, ha a session nincs paid –
      // csak a már paid státuszúakat égetjük (webhook felel a paid-ért).
      if (session.payment_status === 'paid') {
        const results = await confirmPendingAndFinalizeOrderGroup(metaGroupId)
        return NextResponse.json({ ok: true, results })
      }
      const results = await finalizeOrderGroupRewardsSafe(metaGroupId)
      return NextResponse.json({ ok: true, results, waitingForPayment: true })
    }

    if (metaOrderId) {
      if (session.payment_status === 'paid') {
        const order = await getOrderById(metaOrderId)
        if (order?.status === 'payment_pending') {
          await setOrderStatus(
            metaOrderId,
            order.orderType === 'sourcing' ? 'sourcing_pending' : 'paid'
          )
        }
      }
      const result = await finalizeOrderRewards(metaOrderId)
      return NextResponse.json({
        ok: true,
        results: [result],
        waitingForPayment: Boolean(result.skipped),
      })
    }

    return NextResponse.json({ error: 'Order not found for session' }, { status: 404 })
  } catch (err) {
    logger.error({ err }, 'finalize-rewards API failed')
    return NextResponse.json({ error: 'Finalize failed' }, { status: 500 })
  }
}

async function finalizeOrderGroupRewardsSafe(orderGroupId: string) {
  const { finalizeOrderGroupRewards } = await import('@/lib/checkout-rewards')
  return finalizeOrderGroupRewards(orderGroupId)
}
