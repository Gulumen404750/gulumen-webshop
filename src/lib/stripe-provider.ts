import Stripe from 'stripe'
import { readEnv, resolvePublicAppUrl } from '@/lib/bootstrap-auth-env'
import { getPaymentTransactionById } from '@/lib/payment-transactions'
import { logger } from '@/lib/logger'
import {
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  stripeCheckoutMethodFields,
  type CheckoutPaymentMethod,
} from '@/lib/checkout-payment-methods'
import type { Locale } from '@/i18n/locales'
import type {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  CaptureOrCancelResult,
} from '@/lib/payment-provider'

/** Runtime env – ne webpack-inlinelt process.env.STRIPE_SECRET_KEY. */
function stripeSecretKey(): string | undefined {
  return readEnv('STRIPE_SECRET_KEY')
}

function getStripeClient(): Stripe | null {
  const key = stripeSecretKey()
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

export class StripeCheckoutError extends Error {
  readonly code: 'stripe_not_configured' | 'stripe_session_failed'

  constructor(message: string, code: StripeCheckoutError['code'] = 'stripe_session_failed') {
    super(message)
    this.name = 'StripeCheckoutError'
    this.code = code
  }
}

function stripeErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return err instanceof Error ? err.message : 'Stripe checkout failed'
}

function shouldRetryWithoutPaymentMethodTypes(message: string): boolean {
  return /payment_method_types|dynamic payment method|invalid payment method/i.test(message)
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe'

  private getStripe(): Stripe {
    const stripe = getStripeClient()
    if (!stripe) {
      throw new StripeCheckoutError('STRIPE_SECRET_KEY not configured', 'stripe_not_configured')
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
    const currency = params.currency.toLowerCase()
    const methodFields = stripeCheckoutMethodFields(paymentMethod)

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
      customer_email: params.customer.email,
      billing_address_collection: paymentMethod === 'klarna' ? 'required' : 'auto',
      ...methodFields,
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
    }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create(sessionParams)
    } catch (err) {
      const message = stripeErrorMessage(err)
      if (sessionParams.payment_method_types && shouldRetryWithoutPaymentMethodTypes(message)) {
        logger.warn({ err, paymentMethod }, 'Stripe rejected payment_method_types; retrying with dashboard methods')
        const retryParams = { ...sessionParams }
        delete retryParams.payment_method_types
        try {
          session = await stripe.checkout.sessions.create(retryParams)
        } catch (retryErr) {
          logger.error({ err: retryErr, paymentMethod, orderId: params.orderId }, 'Stripe checkout session retry failed')
          throw new StripeCheckoutError(stripeErrorMessage(retryErr), 'stripe_session_failed')
        }
      } else {
        logger.error({ err, paymentMethod, orderId: params.orderId }, 'Stripe checkout session create failed')
        throw new StripeCheckoutError(message, 'stripe_session_failed')
      }
    }

    if (!session.url) {
      throw new StripeCheckoutError(
        'Stripe checkout session created without redirect URL',
        'stripe_session_failed'
      )
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
      logger.error({ err }, 'StripeProvider captureAuthorizedPayment')
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
      logger.error({ err }, 'StripeProvider cancelAuthorizedPayment')
      return { success: false, error: message }
    }
  }
}
