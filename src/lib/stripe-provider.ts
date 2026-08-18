import Stripe from 'stripe'
import { resolvePublicAppUrl } from '@/lib/bootstrap-auth-env'
import { getPaymentTransactionById } from '@/lib/payment-transactions'
import {
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  stripePaymentMethodTypes,
  type CheckoutPaymentMethod,
} from '@/lib/checkout-payment-methods'
import type { Locale } from '@/i18n/locales'
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

const STRIPE_LOCALE: Record<Locale, Stripe.Checkout.SessionCreateParams.Locale> = {
  hu: 'hu',
  en: 'en',
  de: 'de',
  ro: 'ro',
}

function stripeLocale(locale?: Locale): Stripe.Checkout.SessionCreateParams.Locale | undefined {
  if (!locale) return undefined
  return STRIPE_LOCALE[locale]
}

export function resolveStripeCheckoutPaymentMethod(
  paymentMethod?: CheckoutPaymentMethod
): CheckoutPaymentMethod {
  return paymentMethod ?? DEFAULT_CHECKOUT_PAYMENT_METHOD
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
    const paymentMethod = resolveStripeCheckoutPaymentMethod(params.paymentMethod)
    const paymentMethodTypes = stripePaymentMethodTypes(paymentMethod)
    const currency = params.currency.toLowerCase()

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      locale: stripeLocale(params.locale),
      line_items: [
        {
          price_data: {
            currency,
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
        paymentMethod,
      },
      payment_method_types: paymentMethodTypes,
      customer_email: params.customer.email,
      billing_address_collection: paymentMethod === 'klarna' ? 'required' : 'auto',
    }

    if (captureMethod === 'manual') {
      sessionParams.payment_intent_data = {
        capture_method: 'manual',
        metadata: {
          transactionId: params.transactionId,
          orderId: params.orderId,
          paymentMethod,
        },
      }
    } else {
      sessionParams.payment_intent_data = {
        metadata: {
          transactionId: params.transactionId,
          orderId: params.orderId,
          paymentMethod,
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
    const tx = await getPaymentTransactionById(params.transactionId)
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
    const tx = await getPaymentTransactionById(params.transactionId)
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
