import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getPaymentTransactionById, updatePaymentTransactionStatus } from '@/lib/payment-transactions'
import { getOrderById, setOrderStatus } from '@/lib/orders'
import { markReservationsPaidByOrderId, markReservationsCanceledByOrderId } from '@/lib/reservations'
import { enqueueOrderPurchasePointsRedemption } from '@/lib/gamification/order-points'
import { maybeSendOrderGroupConfirmationEmail } from '@/lib/order-email'
import { recordCouponUsageOnPayment } from '@/lib/coupon-checkout'
import type { PaymentTransactionStatus } from '@/lib/payment-transactions'

/**
 * Provider-független payment webhook váz + Stripe webhook (checkout.session.completed).
 *
 * Stripe: stripe-signature header + STRIPE_WEBHOOK_SECRET – constructEvent.
 * Egyéb provider (Dummy, Barion): PAYMENTS_WEBHOOK_SECRET + X-Webhook-Secret header.
 *
 * Generic body: { provider, transactionId, status, providerRef? }
 * status: succeeded | failed | cancelled | pending
 */
const MAX_BODY_SIZE = 64 * 1024

const webhookBodySchema = {
  parse(body: unknown): { provider: string; transactionId: string; status: string; providerRef?: string } | null {
    if (!body || typeof body !== 'object') return null
    const o = body as Record<string, unknown>
    const provider = typeof o.provider === 'string' ? o.provider : null
    const transactionId = typeof o.transactionId === 'string' ? o.transactionId : null
    const status = typeof o.status === 'string' ? o.status : null
    const providerRef = typeof o.providerRef === 'string' ? o.providerRef : undefined
    if (!provider || !transactionId || !status) return null
    return { provider, transactionId, status, providerRef }
  },
}

function getStripeWebhookConfig(): { stripe: Stripe; webhookSecret: string } | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secretKey || !webhookSecret) return null
  return { stripe: new Stripe(secretKey), webhookSecret }
}

async function applyTransactionOutcome(
  transactionId: string,
  newTxStatus: PaymentTransactionStatus,
  providerRef?: string,
  customerEmail?: string | null
): Promise<void> {
  const tx = getPaymentTransactionById(transactionId)
  if (!tx) {
    console.debug('[payments/webhook] Transaction not found', transactionId)
    return
  }

  if (tx.status === 'succeeded' && newTxStatus === 'succeeded') {
    return
  }

  updatePaymentTransactionStatus(transactionId, newTxStatus, providerRef)

  const order = await getOrderById(tx.orderId)
  if (!order) {
    console.debug('[payments/webhook] Order not found for tx', tx.orderId)
    return
  }

  if (newTxStatus === 'succeeded') {
    if (tx.mode === 'capture') {
      await setOrderStatus(order.id, 'paid')
      console.debug('[payments/webhook] Order marked paid (capture)', order.id)
      await enqueueOrderPurchasePointsRedemption({
        id: order.id,
        userId: order.userId,
        pointsUsed: order.pointsUsed ?? 0,
        pointsDiscountHuf: order.pointsDiscountHuf ?? 0,
      })
    } else {
      await setOrderStatus(order.id, 'sourcing_pending')
      console.debug('[payments/webhook] Order marked sourcing_pending (authorize)', order.id)
    }
    await markReservationsPaidByOrderId(order.id)

    await recordCouponUsageOnPayment(order.id)

    try {
      const emailResult = await maybeSendOrderGroupConfirmationEmail(
        order.id,
        customerEmail ?? order.customerEmail ?? null
      )
      if (!emailResult.ok) {
        console.error('[payments/webhook] Order confirmation email failed:', emailResult.error)
      }
    } catch (emailErr) {
      console.error('[payments/webhook] Order confirmation email error (webhook still 200):', emailErr)
    }
  } else if (newTxStatus === 'failed' || newTxStatus === 'cancelled') {
    if (tx.mode === 'authorize') {
      await markReservationsCanceledByOrderId(order.id)
    }
    await setOrderStatus(order.id, 'cancelled')
    console.debug('[payments/webhook] Order marked cancelled', order.id)
  }
}

async function handleStripeWebhook(request: Request, signature: string): Promise<NextResponse> {
  const stripeConfig = getStripeWebhookConfig()
  if (!stripeConfig) {
    console.error('[payments/webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 503 })
  }
  const { stripe, webhookSecret } = stripeConfig

  let body: string
  try {
    body = await request.text()
    if (body.length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[payments/webhook] Stripe signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const transactionId = session.metadata?.transactionId
    if (!transactionId) {
      console.debug('[payments/webhook] checkout.session.completed: missing metadata.transactionId')
      return NextResponse.json({ received: true })
    }

    const tx = getPaymentTransactionById(transactionId)
    if (!tx) {
      console.debug('[payments/webhook] Transaction not found', transactionId)
      return NextResponse.json({ received: true })
    }

    if (tx.status === 'succeeded') {
      return NextResponse.json({ received: true })
    }

    const amountTotal = session.amount_total ?? 0
    const currency = (session.currency ?? 'huf').toLowerCase()
    if (currency !== tx.currency.toLowerCase() || amountTotal !== Math.round(tx.amount)) {
      console.error('[payments/webhook] checkout.session.completed: amount/currency mismatch', {
        transactionId,
        amountTotal,
        expectedAmount: tx.amount,
        currency,
        expectedCurrency: tx.currency,
      })
      await applyTransactionOutcome(transactionId, 'failed', session.id)
      return NextResponse.json({ received: true })
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id

    if (!paymentIntentId) {
      console.error('[payments/webhook] checkout.session.completed: missing payment_intent')
      return NextResponse.json({ received: true })
    }

    if (tx.mode === 'capture') {
      if (session.payment_status !== 'paid') {
        console.warn('[payments/webhook] capture: payment_status !== paid', {
          transactionId,
          payment_status: session.payment_status,
        })
        return NextResponse.json({ received: true })
      }
    } else {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'succeeded') {
        console.warn('[payments/webhook] authorize: unexpected payment intent status', {
          transactionId,
          status: paymentIntent.status,
        })
        return NextResponse.json({ received: true })
      }
    }

    const customerEmail =
      session.customer_details?.email ?? session.customer_email ?? null

    await applyTransactionOutcome(transactionId, 'succeeded', paymentIntentId, customerEmail)
    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}

async function handleGenericWebhook(request: Request): Promise<NextResponse> {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET
  if (!secret) {
    console.error('[payments/webhook] PAYMENTS_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const provided = request.headers.get('x-webhook-secret')
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }
    body = JSON.parse(raw)
  } catch {
    console.debug('[payments/webhook] Invalid JSON')
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const parsed = webhookBodySchema.parse(body)
  if (!parsed) {
    console.debug('[payments/webhook] Missing provider, transactionId or status')
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { transactionId, status, providerRef } = parsed

  const newTxStatus: PaymentTransactionStatus =
    status === 'succeeded'
      ? 'succeeded'
      : status === 'failed' || status === 'cancelled'
        ? status
        : 'pending'

  await applyTransactionOutcome(transactionId, newTxStatus, providerRef)
  return NextResponse.json({ received: true })
}

export async function POST(request: Request) {
  const stripeSignature = request.headers.get('stripe-signature')

  try {
    if (stripeSignature) {
      return await handleStripeWebhook(request, stripeSignature)
    }
    return await handleGenericWebhook(request)
  } catch (err) {
    console.error('[payments/webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
