/**
 * Checkout fizetési módok: kártya, PayPal, Apple Pay / Google Pay (Express Checkout),
 * és külső finanszírozott részletfizetés (Klarna a Stripe-on).
 *
 * Belső elszámolás mindig HUF. A Stripe-terhelés:
 *  - Kártya / Apple Pay / Google Pay + HU locale → HUF
 *  - EN/DE/RO → EUR
 *  - PayPal mindig EUR (a Stripe PayPal nem támogat HUF-ot)
 *  - Klarna mindig EUR (a Stripe Klarna nem támogat HUF-ot)
 */
import type { Locale } from '@/i18n/locales'
import { getConfiguredHufPerEur, hufToEur } from '@/lib/euro-rate'

export const CHECKOUT_PAYMENT_METHODS = [
  'card',
  'paypal',
  'apple_pay',
  'google_pay',
  'klarna',
] as const

export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number]

export type ChargeCurrency = 'huf' | 'eur'

/** Stripe Checkout Session payment_method_types. */
export type StripeCheckoutPaymentMethodType = 'card' | 'paypal' | 'klarna'

export function isCheckoutPaymentMethod(value: string): value is CheckoutPaymentMethod {
  return (CHECKOUT_PAYMENT_METHODS as readonly string[]).includes(value)
}

/** PayPal és Klarna: mindig EUR. Kártya/tárca: a felület valutája. */
export function resolveChargeCurrency(
  paymentMethod: CheckoutPaymentMethod,
  locale: Locale
): ChargeCurrency {
  if (paymentMethod === 'klarna' || paymentMethod === 'paypal') return 'eur'
  return locale === 'hu' ? 'huf' : 'eur'
}

export function isStripeCurrencyUnsupportedMessage(message: string): boolean {
  return /currency|not supported|presentment|invalid.*huf|\bhuf\b/i.test(message)
}

/** Stripe unit amount: HUF = forint, EUR = cent. */
export function toStripeUnitAmount(
  amountHuf: number,
  currency: ChargeCurrency,
  hufPerEur: number = getConfiguredHufPerEur()
): number {
  const huf = Number.isFinite(amountHuf) ? amountHuf : 0
  if (currency === 'huf') return Math.round(huf)
  return Math.round(hufToEur(huf, hufPerEur) * 100)
}

export function stripeCheckoutAmountMatches(params: {
  amountTotal: number
  currency: string
  expectedAmount: number
  expectedCurrency: string
}): boolean {
  const currency = (params.currency || 'huf').toLowerCase()
  const expectedCurrency = (params.expectedCurrency || 'huf').toLowerCase()
  return currency === expectedCurrency && params.amountTotal === Math.round(params.expectedAmount)
}

/**
 * Apple Pay / Google Pay a Stripe Checkouton a card + wallet Express Checkout.
 * PayPal és Klarna külön payment_method_type.
 */
export function stripePaymentMethodTypes(
  paymentMethod: CheckoutPaymentMethod
): StripeCheckoutPaymentMethodType[] {
  if (paymentMethod === 'paypal') return ['paypal']
  if (paymentMethod === 'klarna') return ['klarna']
  return ['card']
}

/**
 * Stripe Checkout Session mezők.
 * Kártya / Apple Pay / Google Pay: NE küldjünk `payment_method_types`-ot
 * (Dashboard dynamic payment methods + Express Checkout). PayPal/Klarna marad explicit.
 */
export type StripeCheckoutMethodFields = {
  payment_method_types?: StripeCheckoutPaymentMethodType[]
  excluded_payment_method_types?: Array<'paypal' | 'klarna'>
}

export function stripeCheckoutMethodFields(
  paymentMethod: CheckoutPaymentMethod
): StripeCheckoutMethodFields {
  if (paymentMethod === 'paypal') return { payment_method_types: ['paypal'] }
  if (paymentMethod === 'klarna') return { payment_method_types: ['klarna'] }
  return { excluded_payment_method_types: ['paypal', 'klarna'] }
}

export function isExpressWalletMethod(paymentMethod: CheckoutPaymentMethod): boolean {
  return paymentMethod === 'apple_pay' || paymentMethod === 'google_pay'
}

/**
 * Külső finanszírozó (Klarna): a partner a vásárláskor kifizeti a teljes összeget,
 * a jutalékot automatikusan levonja, nálunk a rendelés azonnal kifizetett.
 * Sourcing rendelésnél is capture (nem authorize), hogy a gyártás elindulhasson.
 */
export function forcesImmediateCapture(paymentMethod: CheckoutPaymentMethod): boolean {
  return paymentMethod === 'klarna'
}

/** Külső finanszírozott részletfizetés: vásárlási pont nem jár. */
export function isInstallmentPayment(paymentMethod?: string | null): boolean {
  return paymentMethod === 'klarna'
}

export function resolvePaymentMode(
  orderType: 'in_stock' | 'sourcing',
  paymentMethod: CheckoutPaymentMethod
): 'capture' | 'authorize' {
  if (forcesImmediateCapture(paymentMethod)) return 'capture'
  return orderType === 'in_stock' ? 'capture' : 'authorize'
}

export const DEFAULT_CHECKOUT_PAYMENT_METHOD: CheckoutPaymentMethod = 'card'

/** Klarna részletfizetés: a fizetendő végösszeg (kupon/pont után, szállítással) legalább ennyi. */
export const KLARNA_MIN_AMOUNT_HUF = 35_000

export function isKlarnaEligible(amountHuf: number): boolean {
  return Number.isFinite(amountHuf) && amountHuf >= KLARNA_MIN_AMOUNT_HUF
}
