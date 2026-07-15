/**
 * Payment Provider Abstraction – provider-független fizetési interfész.
 * Implementációk: DummyProvider, StripeProvider (Barion, SimplePay később).
 */

import { StripeProvider } from '@/lib/stripe-provider'

export type PaymentCustomer = {
  email: string
  name?: string
}

export type CreatePaymentParams = {
  /** Belső tranzakció id – webhook/callback egyezményhez. */
  transactionId: string
  amount: number
  currency: string
  orderId: string
  orderGroupId: string
  customer: PaymentCustomer
}

/** Redirect alapú: a kliens erre az URL-re megy. */
export type PaymentResultRedirect = {
  type: 'redirect'
  url: string
  transactionId: string
}

/** Client-secret / token alapú: a kliens ezt használja (pl. Stripe Elements). */
export type PaymentResultClientSecret = {
  type: 'client_secret'
  clientSecret: string
  transactionId: string
}

/** Dummy / mock: nincs redirect, csak pending. */
export type PaymentResultPending = {
  type: 'pending'
  transactionId: string
  message?: string
}

export type CreatePaymentResult =
  | PaymentResultRedirect
  | PaymentResultClientSecret
  | PaymentResultPending

export type CaptureOrCancelResult = {
  success: boolean
  error?: string
}

export interface PaymentProvider {
  readonly name: string

  /** Azonnali terhelés (in_stock rendelés). */
  createCapturePayment(params: CreatePaymentParams): Promise<CreatePaymentResult>

  /** Előengedély / zárolás (sourcing rendelés), később capture vagy cancel. */
  createAuthorizationPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>

  /** Zárolt összeg levonása (sourcing sikeres beszerzés után). */
  captureAuthorizedPayment(params: { transactionId: string }): Promise<CaptureOrCancelResult>

  /** Zárolás felszabadítása (sourcing sikertelen). */
  cancelAuthorizedPayment(params: { transactionId: string }): Promise<CaptureOrCancelResult>
}

/**
 * DummyProvider – mock implementáció: nem hív külső API-t,
 * mindig "pending" eredményt ad. End-to-end teszteléshez.
 */
export class DummyProvider implements PaymentProvider {
  readonly name = 'dummy'

  async createCapturePayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    console.debug('[DummyProvider] createCapturePayment', { transactionId: params.transactionId })
    return {
      type: 'pending',
      transactionId: params.transactionId,
      message: 'Mock capture – feldolgozás alatt',
    }
  }

  async createAuthorizationPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    console.debug('[DummyProvider] createAuthorizationPayment', { transactionId: params.transactionId })
    return {
      type: 'pending',
      transactionId: params.transactionId,
      message: 'Mock authorization – zárolás alatt',
    }
  }

  async captureAuthorizedPayment(params: { transactionId: string }): Promise<CaptureOrCancelResult> {
    console.debug('[DummyProvider] captureAuthorizedPayment', params)
    return { success: true }
  }

  async cancelAuthorizedPayment(params: { transactionId: string }): Promise<CaptureOrCancelResult> {
    console.debug('[DummyProvider] cancelAuthorizedPayment', params)
    return { success: true }
  }
}

let defaultProvider: PaymentProvider | null = null

/** Beállítja az alapértelmezett providert (pl. DummyProvider vagy StripeProvider). */
export function setDefaultPaymentProvider(provider: PaymentProvider): void {
  defaultProvider = provider
}

/** Visszaadja az alapértelmezett providert. STRIPE_SECRET_KEY esetén Stripe, különben Dummy. */
export function getPaymentProvider(): PaymentProvider {
  if (!defaultProvider) {
    defaultProvider = process.env.STRIPE_SECRET_KEY?.trim()
      ? new StripeProvider()
      : new DummyProvider()
  }
  return defaultProvider
}
