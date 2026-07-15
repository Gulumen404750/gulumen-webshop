import Stripe from 'stripe'
import { resolvePublicAppUrl } from '@/lib/bootstrap-auth-env'
import { getPaymentTransactionById } from '@/lib/payment-transactions'
import type {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  CaptureOrCancelResult,
} from '@/lib/payment-provider'

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  return key ? new Stripe(key) : null
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe'

  private getStripe(): Stripe {
    const stripe = getStripeClient()
    if (!stripe) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    return stripe
  }

  private async createCheckoutSession(
    params: CreatePaymentParams,
    captureMethod: 'automatic' | 'manual'
  ): Promise<CreatePaymentResult> {
    const stripe = this.getStripe()
    const appUrl = resolvePublicAppUrl()

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: `Rendelés ${params.orderId}`,
            },
            unit_amount: Math.round(params.amount),
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/fizetes/siker?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/fizetes/megszakitva`,
      metadata: {
        transactionId: params.transactionId,
        orderId: params.orderId,
        orderGroupId: params.orderGroupId,
      },
      payment_method_types: ['card'],
      customer_email: params.customer.email,
    }

    if (captureMethod === 'manual') {
      sessionParams.payment_intent_data = {
        capture_method: 'manual',
        metadata: {
          transactionId: params.transactionId,
          orderId: params.orderId,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    if (!session.url) {
      throw new Error('Stripe checkout session created without redirect URL')
    }

    return {
      type: 'redirect',
      url: session.url,
      transactionId: params.transactionId,
    }
  }

  async createCapturePayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    return this.createCheckoutSession(params, 'automatic')
  }

  async createAuthorizationPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    return this.createCheckoutSession(params, 'manual')
  }

  async captureAuthorizedPayment(params: { transactionId: string }): Promise<CaptureOrCancelResult> {
    const tx = getPaymentTransactionById(params.transactionId)
    if (!tx?.providerRef) {
      return { success: false, error: 'Payment intent not found for transaction' }
    }
    try {
      await this.getStripe().paymentIntents.capture(tx.providerRef)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capture failed'
      console.error('[StripeProvider] captureAuthorizedPayment', err)
      return { success: false, error: message }
    }
  }

  async cancelAuthorizedPayment(params: { transactionId: string }): Promise<CaptureOrCancelResult> {
    const tx = getPaymentTransactionById(params.transactionId)
    if (!tx?.providerRef) {
      return { success: false, error: 'Payment intent not found for transaction' }
    }
    try {
      await this.getStripe().paymentIntents.cancel(tx.providerRef)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancel failed'
      console.error('[StripeProvider] cancelAuthorizedPayment', err)
      return { success: false, error: message }
    }
  }
}
