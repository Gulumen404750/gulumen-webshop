import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrderById, getOrdersByGroupId, setOrderStatus } from '@/lib/orders'
import {
  finalizeOrderGroupRewards,
  finalizeOrderRewards,
} from '@/lib/checkout-rewards'
import { logger } from '@/lib/logger'
import {
  canElevateOrderFromProof,
  verifyStripeCheckoutSession,
  verifyStripePaymentIntent,
  type StripePaymentProof,
} from '@/lib/stripe-payment-proof'

/**
 * POST /api/checkout/finalize-rewards
 * Siker oldal hívja: webhook mellett / helyett is érvényteleníti a kuponokat és levonja a pontokat.
 *
 * Státuszemelés (payment_pending → paid / sourcing_pending) CSAK Stripe bizonyítékkal:
 * sessionId (Checkout Session) vagy paymentIntentId.
 * orderId / orderGroupId önmagában csak már paid-like rendeléseken futtat reward finalize-t.
 * Idempotens.
 */
const bodySchema = z.object({
  sessionId: z.string().min(1).optional(),
  paymentIntentId: z.string().min(1).optional(),
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

  const { sessionId, paymentIntentId, orderGroupId, orderId } = parsed.data
  if (!sessionId && !paymentIntentId && !orderGroupId && !orderId) {
    return NextResponse.json(
      { error: 'sessionId, paymentIntentId, orderGroupId or orderId required' },
      { status: 400 }
    )
  }

  try {
    // 1) Stripe Checkout Session – egyetlen út státuszemelésre session alapján
    if (sessionId) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }
      let proof: StripePaymentProof | null
      try {
        proof = await verifyStripeCheckoutSession(sessionId)
      } catch (err) {
        logger.error({ err, sessionId }, 'finalize-rewards: session verify failed')
        return NextResponse.json({ error: 'Invalid Stripe session' }, { status: 400 })
      }
      if (!proof) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }

      const metaGroupId = proof.orderGroupId
      const metaOrderId = proof.orderId
      const canElevate = canElevateOrderFromProof(proof)

      if (metaGroupId) {
        if (canElevate) {
          const results = await elevateAndFinalizeGroup(metaGroupId)
          return NextResponse.json({ ok: true, results, ...summarizeFinalizeResults(results) })
        }
        const results = await finalizeOrderGroupRewards(metaGroupId)
        return NextResponse.json({
          ok: true,
          results,
          waitingForPayment: true,
          ...summarizeFinalizeResults(results),
        })
      }

      if (metaOrderId) {
        if (canElevate) {
          await elevateOrderIfPending(metaOrderId)
        }
        const result = await finalizeOrderRewards(metaOrderId)
        return NextResponse.json({
          ok: true,
          results: [result],
          waitingForPayment: Boolean(result.skipped) || !canElevate,
          ...summarizeFinalizeResults([result]),
        })
      }

      return NextResponse.json({ error: 'Order not found for session' }, { status: 404 })
    }

    // 2) PaymentIntent bizonyíték
    if (paymentIntentId) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }
      let proof: StripePaymentProof | null
      try {
        proof = await verifyStripePaymentIntent(paymentIntentId)
      } catch (err) {
        logger.error({ err, paymentIntentId }, 'finalize-rewards: PI verify failed')
        return NextResponse.json({ error: 'Invalid payment intent' }, { status: 400 })
      }
      if (!proof) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }
      if (!canElevateOrderFromProof(proof)) {
        return NextResponse.json(
          { error: 'Payment not completed', waitingForPayment: true },
          { status: 402 }
        )
      }

      const targetGroupId = proof.orderGroupId ?? orderGroupId
      const targetOrderId = proof.orderId ?? orderId

      if (targetGroupId) {
        const results = await elevateAndFinalizeGroup(targetGroupId)
        return NextResponse.json({ ok: true, results, ...summarizeFinalizeResults(results) })
      }
      if (targetOrderId) {
        await elevateOrderIfPending(targetOrderId)
        const result = await finalizeOrderRewards(targetOrderId)
        return NextResponse.json({
          ok: true,
          results: [result],
          ...summarizeFinalizeResults([result]),
        })
      }
      return NextResponse.json({ error: 'Order not found for payment intent' }, { status: 404 })
    }

    // 3) orderGroupId / orderId ÖNMAGÁBAN: NINCS státuszemelés (Dummy már a checkoutban zár)
    if (orderGroupId) {
      const orders = await getOrdersByGroupId(orderGroupId)
      if (!orders.length) return NextResponse.json({ error: 'Orders not found' }, { status: 404 })
      const results = await finalizeOrderGroupRewards(orderGroupId)
      return NextResponse.json({ ok: true, results, ...summarizeFinalizeResults(results) })
    }

    if (orderId) {
      const order = await getOrderById(orderId)
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      if (order.orderGroupId) {
        const results = await finalizeOrderGroupRewards(order.orderGroupId)
        return NextResponse.json({ ok: true, results, ...summarizeFinalizeResults(results) })
      }
      const result = await finalizeOrderRewards(orderId)
      return NextResponse.json({
        ok: true,
        results: [result],
        ...summarizeFinalizeResults([result]),
      })
    }

    return NextResponse.json({ error: 'Nothing to finalize' }, { status: 400 })
  } catch (err) {
    logger.error({ err }, 'finalize-rewards API failed')
    return NextResponse.json({ error: 'Finalize failed' }, { status: 500 })
  }
}

/** payment_pending → paid / sourcing_pending, majd reward finalize a csoportra. */
async function elevateAndFinalizeGroup(orderGroupId: string) {
  const orders = await getOrdersByGroupId(orderGroupId)
  for (const order of orders) {
    await elevateOrderIfPending(order.id)
  }
  return finalizeOrderGroupRewards(orderGroupId)
}

async function elevateOrderIfPending(orderId: string): Promise<void> {
  const order = await getOrderById(orderId)
  if (!order || order.status !== 'payment_pending') return
  await setOrderStatus(
    orderId,
    order.orderType === 'sourcing' ? 'sourcing_pending' : 'paid'
  )
}

function summarizeFinalizeResults(
  results: Array<{
    balanceAfter?: number
    burned?: { pointsUsed?: number; pointsEarned?: number }
    loyalty?: {
      credited?: boolean
      loyaltyPercent?: number
      previousPercent?: number
      qualifyingPaidOrdersCount?: number
    }
  }>
) {
  let pointsUsed = 0
  let pointsEarned = 0
  let balance: number | undefined
  let loyaltyPercent = 0
  let loyaltyCredited = false
  let loyaltyPreviousPercent = 0
  let qualifyingPaidOrdersCount = 0
  for (const r of results) {
    pointsUsed += r.burned?.pointsUsed ?? 0
    pointsEarned += r.burned?.pointsEarned ?? 0
    if (typeof r.balanceAfter === 'number') balance = r.balanceAfter
    if (typeof r.loyalty?.loyaltyPercent === 'number' && r.loyalty.loyaltyPercent > loyaltyPercent) {
      loyaltyPercent = r.loyalty.loyaltyPercent
      loyaltyPreviousPercent = r.loyalty.previousPercent ?? 0
      qualifyingPaidOrdersCount = r.loyalty.qualifyingPaidOrdersCount ?? 0
    }
    if (r.loyalty?.credited) loyaltyCredited = true
  }
  return {
    pointsUsed,
    pointsEarned,
    loyaltyPercent,
    loyaltyCredited,
    loyaltyPreviousPercent,
    qualifyingPaidOrdersCount,
    ...(typeof balance === 'number' ? { balance } : {}),
  }
}
