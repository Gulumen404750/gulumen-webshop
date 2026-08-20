/**
 * Checkout API hibakód → i18n kulcs. A szerver angol/technikai `error` stringje
 * soha ne menjen ki a vásárlónak.
 */
export function checkoutErrorI18nKey(code: string | undefined, status: number): string {
  if (status === 429) return 'payment.errorRateLimited'
  switch (code) {
    case 'coupon_min_order':
      return 'payment.couponMinOrder'
    case 'coupon_invalid':
      return 'payment.couponInvalid'
    case 'coupon_inactive':
      return 'giftClaim.errorCouponInactive'
    case 'coupon_expired':
      return 'giftClaim.errorCouponExpired'
    case 'coupon_used':
      return 'giftClaim.errorCouponUsed'
    case 'coupon_wrong_user':
      return 'giftClaim.errorCouponWrongUser'
    case 'coupon_stack_disabled':
      return 'payment.couponCatRegStackBlocked'
    case 'points_promo_stack_disabled':
      return 'payment.pointsPromoStackDisabled'
    case 'timed_offer_unavailable':
      return 'payment.timedOfferNoLongerAvailable'
    case 'insufficient_stock':
    case 'out_of_stock':
      return 'payment.errorOutOfStock'
    case 'klarna_min_amount':
      return 'payment.errorKlarnaMinAmount'
    case 'stripe_not_configured':
      return 'payment.errorStripeNotConfigured'
    case 'stripe_session_failed':
    case 'checkout_order_failed':
      return 'payment.errorStripeSession'
    case 'gift_code_login_required':
    case 'login_required':
      return 'giftClaim.loginRequired'
    default:
      return 'payment.errorCreateSession'
  }
}

export function resolveCheckoutErrorMessage(params: {
  t: (key: string, vars?: Record<string, string | number>) => string
  money: (huf: number) => string
  status: number
  code?: string
  minOrderHuf?: number
  errorIncludesTimed?: boolean
}): string {
  const code =
    params.code ||
    (params.errorIncludesTimed ? 'timed_offer_unavailable' : undefined)
  const key = checkoutErrorI18nKey(code, params.status)
  if (key === 'payment.couponMinOrder') {
    return params.t(key, { amount: params.money(params.minOrderHuf ?? 0) })
  }
  return params.t(key)
}
