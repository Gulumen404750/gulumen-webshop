/**
 * Stripe fizetésbizonyíték ellenőrzés (checkout session / payment intent).
 * A finalize-rewards és hasonló nyilvános útvonalak csak ezután emelhetnek paid státuszra.
 */
import Stripe from 'stripe'

export type StripePaymentProof = {
  paid: boolean
  /** Authorize (manual capture) is elfogadott – sourcing. */
  authorized: boolean
  orderId?: string
  orderGroupId?: string
  paymentIntentId?: string
  sessionId?: string
  amountTotal?: number | null
  currency?: string | null
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  return key ? new Stripe(key) : null
}

function metaIds(meta: Stripe.Metadata | null | undefined): {
  orderId?: string
  orderGroupId?: string
} {
  const orderId = meta?.orderId?.trim() || undefined
  const orderGroupId = meta?.orderGroupId?.trim() || undefined
  return { orderId, orderGroupId }
}

/**
 * Checkout Session: capture → payment_status === 'paid';
 * authorize → PaymentIntent requires_capture | succeeded.
 */
export async function verifyStripeCheckoutSession(
  sessionId: string
): Promise<StripePaymentProof | null> {
  const stripe = getStripe()
  if (!stripe) return null

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  })
  const { orderId, orderGroupId } = metaIds(session.metadata)

  const pi =
    typeof session.payment_intent === 'string'
      ? await stripe.paymentIntents.retrieve(session.payment_intent)
      : session.payment_intent && typeof session.payment_intent === 'object'
        ? session.payment_intent
        : null

  const piStatus = pi?.status
  const paid = session.payment_status === 'paid'
  const authorized =
    piStatus === 'requires_capture' || piStatus === 'succeeded' || paid

  return {
    paid,
    authorized,
    orderId,
    orderGroupId,
    paymentIntentId: pi?.id,
    sessionId: session.id,
    amountTotal: session.amount_total,
    currency: session.currency,
  }
}

/**
 * PaymentIntent: succeeded / requires_capture elfogadott.
 * orderId / orderGroupId a PI metadata-ból (ha van).
 */
export async function verifyStripePaymentIntent(
  paymentIntentId: string
): Promise<StripePaymentProof | null> {
  const stripe = getStripe()
  if (!stripe) return null

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  const { orderId, orderGroupId } = metaIds(pi.metadata)
  const authorized = pi.status === 'requires_capture' || pi.status === 'succeeded'
  const paid = pi.status === 'succeeded'

  return {
    paid,
    authorized,
    orderId,
    orderGroupId,
    paymentIntentId: pi.id,
    amountTotal: pi.amount_received || pi.amount,
    currency: pi.currency,
  }
}

/** Státuszemelés csak ha a fizetés ténylegesen megvan / authorize-olva. */
export function canElevateOrderFromProof(proof: StripePaymentProof): boolean {
  return proof.paid || proof.authorized
}
