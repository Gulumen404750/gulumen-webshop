import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import {
  getOrderById,
  getOrderByPaymentIntentId,
  setOrderPaid,
  setOrderFailed,
  setOrderCountedForLoyalty,
} from '@/lib/orders'
import { sendOrderConfirmationEmail } from '@/lib/order-email'
import { qualifiesForLoyalty, incrementQualifyingOrder, decrementQualifyingOrder } from '@/lib/loyalty'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/** Stripe HUF: zero-decimal – amount_total forintban (egész), nem fillér. */
function expectedAmountTotalHuf(orderTotalHuf: number): number {
  return Math.round(orderTotalHuf)
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

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
    console.error('Stripe webhook signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.orderId
      if (!orderId) {
        console.error('checkout.session.completed: missing metadata.orderId')
        return NextResponse.json({ received: true })
      }

      const order = getOrderById(orderId)
      if (!order) {
        console.error('checkout.session.completed: order not found', orderId)
        return NextResponse.json({ received: true })
      }

      if (order.status === 'paid') {
        return NextResponse.json({ received: true })
      }
      if (order.paidWebhookEventId === event.id) {
        return NextResponse.json({ received: true })
      }

      if (session.payment_status !== 'paid') {
        console.warn('checkout.session.completed: payment_status !== paid', {
          orderId,
          payment_status: session.payment_status,
        })
        return NextResponse.json({ received: true })
      }

      const amountTotal = session.amount_total ?? 0
      const currency = (session.currency ?? 'huf').toLowerCase()
      const expectedTotal = expectedAmountTotalHuf(order.totalHuf)

      if (currency !== 'huf') {
        console.error('checkout.session.completed: currency mismatch', {
          orderId,
          currency,
          expected: 'huf',
        })
        setOrderFailed(orderId)
        return NextResponse.json({ received: true })
      }

      if (amountTotal !== expectedTotal) {
        console.error('checkout.session.completed: amount_total mismatch', {
          orderId,
          amountTotal,
          expectedTotal,
          orderTotalHuf: order.totalHuf,
        })
        setOrderFailed(orderId)
        return NextResponse.json({ received: true })
      }

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id
      const customerEmail =
        session.customer_details?.email ?? session.customer_email ?? null

      setOrderPaid({
        orderId,
        stripeSessionId: session.id,
        paymentIntentId: paymentIntentId ?? undefined,
        amountPaid: amountTotal,
        currencyPaid: currency,
        webhookEventId: event.id,
        customerEmail: customerEmail ?? undefined,
      })

      // Hűségkedvezmény: csak ha még nem számoltuk, és a végösszeg eléri a küszöböt (HUF/EUR)
      const updatedOrder = getOrderById(orderId)
      if (updatedOrder && !updatedOrder.countedForLoyalty && customerEmail) {
        if (qualifiesForLoyalty(amountTotal, currency)) {
          incrementQualifyingOrder(customerEmail)
          setOrderCountedForLoyalty(orderId)
        }
      }

      try {
        if (updatedOrder) {
          const emailResult = await sendOrderConfirmationEmail(
            updatedOrder,
            customerEmail
          )
          if (!emailResult.ok) {
            console.error('checkout.session.completed: email send failed', emailResult.error)
          }
        }
      } catch (emailErr) {
        console.error('checkout.session.completed: email error (webhook still 200)', emailErr)
      }

      return NextResponse.json({ received: true })
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata?.orderId
      if (orderId) {
        setOrderFailed(orderId)
      }
      return NextResponse.json({ received: true })
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
      if (!paymentIntentId) return NextResponse.json({ received: true })
      const order = getOrderByPaymentIntentId(paymentIntentId)
      if (!order || !order.countedForLoyalty || !order.customerEmail) {
        return NextResponse.json({ received: true })
      }
      const amountPaid = order.amountPaid ?? 0
      const amountRefunded = charge.amount_refunded ?? 0
      const isFullRefund = amountPaid > 0 && amountRefunded >= amountPaid
      if (isFullRefund) {
        decrementQualifyingOrder(order.customerEmail)
        setOrderCountedForLoyalty(order.id, false)
      }
      return NextResponse.json({ received: true })
    }

    default:
      return NextResponse.json({ received: true })
  }
}
