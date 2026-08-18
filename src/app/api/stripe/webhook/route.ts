import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import {
  getOrderById,
  getOrderByPaymentIntentId,
  setOrderPaid,
  setOrderFailed,
  setOrderCountedForLoyalty,
} from '@/lib/orders'
import { markReservationsPaidByOrderId } from '@/lib/reservations'
import { maybeSendOrderGroupConfirmationEmail } from '@/lib/order-email'
import { applyLoyaltyForPaidOrder, decrementQualifyingOrder } from '@/lib/loyalty'
import { finalizeOrderRewards } from '@/lib/checkout-rewards'
import { clearUserCartSnapshot } from '@/lib/cart-snapshot'
import { logger } from '@/lib/logger'
import { dispatchProductionJobForPaidOrder } from '@/lib/production-dispatch'
import {
  stripeCheckoutAmountMatches,
  toStripeUnitAmount,
  type ChargeCurrency,
} from '@/lib/checkout-payment-methods'
import { getConfiguredHufPerEur } from '@/lib/euro-rate'
import { getPaymentTransactionById } from '@/lib/payment-transactions'

function isChargeCurrency(value: string): value is ChargeCurrency {
  return value === 'huf' || value === 'eur'
}

async function stripeAmountMatchesOrder(params: {
  amountTotal: number
  currency: string
  orderTotalHuf: number
  transactionId?: string
}): Promise<boolean> {
  const currency = (params.currency || 'huf').toLowerCase()
  if (!isChargeCurrency(currency)) return false

  if (params.transactionId) {
    const tx = await getPaymentTransactionById(params.transactionId)
    if (tx) {
      return stripeCheckoutAmountMatches({
        amountTotal: params.amountTotal,
        currency,
        expectedAmount: tx.amount,
        expectedCurrency: tx.currency,
      })
    }
  }

  const expected = toStripeUnitAmount(params.orderTotalHuf, currency, getConfiguredHufPerEur())
  return stripeCheckoutAmountMatches({
    amountTotal: params.amountTotal,
    currency,
    expectedAmount: expected,
    expectedCurrency: currency,
  })
}

/** Lazy init: ne modul betöltéskor inicializáljuk, hogy hiányzó STRIPE_SECRET_KEY ne törje a buildet. */
function getStripe(): { stripe: Stripe; webhookSecret: string } | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) return null
  return {
    stripe: new Stripe(secretKey),
    webhookSecret,
  }
}

export async function POST(request: Request) {
  const stripeConfig = getStripe()
  if (!stripeConfig) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 501 }
    )
  }
  const { stripe, webhookSecret } = stripeConfig

  // Kötelező: constructEvent-hez raw body kell – request.text(), nem request.json()
  let body: string
  let signature: string | null
  try {
    body = await request.text()
    signature = request.headers.get('stripe-signature') ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err: message }, 'Stripe webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // Új checkout: metadata.transactionId (+ orderId). Régi: csak orderId.
      const orderId = session.metadata?.orderId
      const transactionId = session.metadata?.transactionId

      if (!orderId && transactionId) {
        // Ha a Stripe Dashboard még a legacy /api/stripe/webhook-ra mutat,
        // de az új checkout csak transactionId-t vár a payments webhookban:
        // irányítsuk át a payments handler logikára a transactionId alapján.
        logger.warn(
          { transactionId },
          'checkout.session.completed: legacy stripe webhook got transactionId without orderId – prefer /api/payments/webhook'
        )
      }

      if (!orderId) {
        logger.error('checkout.session.completed: missing metadata.orderId')
        return NextResponse.json({ received: true })
      }

      const order = await getOrderById(orderId)
      if (!order) {
        logger.error({ orderId }, 'checkout.session.completed: order not found')
        return NextResponse.json({ received: true })
      }

      // Már paid: ne állítsuk újra paid-ra, de jutalom + e-mail idempotens retry.
      if (order.status === 'paid' || order.paidWebhookEventId === event.id) {
        try {
          await finalizeOrderRewards(orderId)
        } catch (err) {
          logger.error({ err, orderId }, 'checkout.session.completed: finalize retry failed')
        }
        const customerEmailRetry =
          session.customer_details?.email ?? session.customer_email ?? null
        try {
          const emailResult = await maybeSendOrderGroupConfirmationEmail(
            orderId,
            customerEmailRetry
          )
          if (!emailResult.ok) {
            logger.error(
              { err: emailResult.error, orderId },
              'checkout.session.completed: email retry failed'
            )
          } else if (emailResult.sent) {
            logger.info({ orderId }, 'checkout.session.completed: email sent on retry')
          }
        } catch (emailErr) {
          logger.error(
            { err: emailErr, orderId },
            'checkout.session.completed: email retry error'
          )
        }
        return NextResponse.json({ received: true })
      }

      if (session.payment_status !== 'paid') {
        logger.warn({ orderId, payment_status: session.payment_status }, 'checkout.session.completed: payment_status !== paid')
        return NextResponse.json({ received: true })
      }

      const amountTotal = session.amount_total ?? 0
      const currency = (session.currency ?? 'huf').toLowerCase()
      const amountOk = await stripeAmountMatchesOrder({
        amountTotal,
        currency,
        orderTotalHuf: order.totalHuf,
        transactionId,
      })

      if (!amountOk) {
        logger.error(
          { orderId, amountTotal, currency, orderTotalHuf: order.totalHuf, transactionId },
          'checkout.session.completed: amount/currency mismatch'
        )
        await setOrderFailed(orderId)
        return NextResponse.json({ received: true })
      }

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id
      const customerEmail =
        session.customer_details?.email ?? session.customer_email ?? null

      const paidResult = await setOrderPaid({
        orderId,
        stripeSessionId: session.id,
        paymentIntentId: paymentIntentId ?? undefined,
        amountPaid: amountTotal,
        currencyPaid: currency,
        webhookEventId: event.id,
        customerEmail: customerEmail ?? undefined,
      })

      // Késői fizetés cancelled/failed/expired után: NINCS automatikus teljesítés / készlet-fogyasztás
      if (paidResult.latePayment) {
        logger.warn(
          {
            event: 'LATE_PAYMENT_WARNING',
            orderId,
            status: paidResult.order?.status,
            stripeSessionId: session.id,
          },
          'checkout.session.completed: late payment → needs_manual_review (no auto fulfillment)'
        )
        return NextResponse.json({
          received: true,
          latePayment: true,
          status: 'needs_manual_review',
        })
      }

      await markReservationsPaidByOrderId(orderId)

      // Kuponok érvénytelenítése + pontlevonás (idempotens)
      try {
        await finalizeOrderRewards(orderId)
      } catch (err) {
        logger.error({ err, orderId }, 'checkout.session.completed: finalizeOrderRewards failed')
      }

      const updatedOrder = paidResult.order ?? (await getOrderById(orderId))
      if (updatedOrder?.userId) {
        await clearUserCartSnapshot(updatedOrder.userId)
      }

      try {
        await applyLoyaltyForPaidOrder(orderId)
      } catch (err) {
        logger.error({ err, orderId }, 'checkout.session.completed: loyalty credit failed')
      }

      try {
        const emailResult = await maybeSendOrderGroupConfirmationEmail(orderId, customerEmail)
        if (!emailResult.ok) {
          logger.error({ err: emailResult.error }, 'checkout.session.completed: email send failed')
        }
      } catch (emailErr) {
        logger.error({ err: emailErr }, 'checkout.session.completed: email error (webhook still 200)')
      }

      try {
        await dispatchProductionJobForPaidOrder(orderId)
      } catch (prodErr) {
        logger.error({ err: prodErr, orderId }, 'checkout.session.completed: production job failed')
      }

      return NextResponse.json({ received: true })
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata?.orderId
      if (orderId) {
        await setOrderFailed(orderId)
      }
      return NextResponse.json({ received: true })
    }

    case 'charge.refunded': {
      // Üzleti szabály: elállás / visszatérítéskor CSAK a kifizetett pénz jár vissza.
      // Felhasznált pontok (PURCHASE_REDEEM) és kuponok NEM állnak vissza – véglegesen elhasználódtak.
      const charge = event.data.object as Stripe.Charge
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
      if (!paymentIntentId) return NextResponse.json({ received: true })
      const order = await getOrderByPaymentIntentId(paymentIntentId)
      if (!order || !order.countedForLoyalty || !order.customerEmail) {
        return NextResponse.json({ received: true })
      }
      const amountPaid = order.amountPaid ?? 0
      const amountRefunded = charge.amount_refunded ?? 0
      const isFullRefund = amountPaid > 0 && amountRefunded >= amountPaid
      if (isFullRefund) {
        await decrementQualifyingOrder(order.customerEmail)
        await setOrderCountedForLoyalty(order.id, false)
      }
      return NextResponse.json({ received: true })
    }

    default:
      return NextResponse.json({ received: true })
  }
}
