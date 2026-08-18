import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProductsByIdsAsync, getTimedPurchaseStatus } from '@/lib/data'
import type { Product } from '@/lib/data'
import {
  generateOrderGroupId,
  createCheckoutOrders,
  setOrderStatus,
  getProductOrdersCount,
  OutOfStockException,
} from '@/lib/orders'
import {
  createPaymentTransaction,
} from '@/lib/payment-transactions'
import { getPaymentProvider } from '@/lib/payment-provider'
import { getLoyaltyByEmail } from '@/lib/loyalty'
import {
  capCombinedCouponPercent,
  capLoyaltyPercent,
  CAT_COUPON_PERCENT,
  REGISTRATION_COUPON_PERCENT,
  isCatRegistrationStackBlocked,
  isCouponStackingBlocked,
  isFixedCouponDiscount,
} from '@/lib/coupon-config'
import { rateLimit } from '@/lib/rate-limit'
import {
  getIdempotencyKey,
  getIdempotentResponse,
  setIdempotentResponse,
} from '@/lib/idempotency'
import { logger } from '@/lib/logger'
import {
  reserveSourcingSlots,
  linkReservationsToOrder,
  SoldOutError,
} from '@/lib/reservations'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { getPointBalance } from '@/lib/gamification/point-ledger'
import { getAvailableGiftPoints } from '@/lib/gamification/gift-points'
import { claimGiftPointCode } from '@/lib/gamification/gift-point-codes'
import { lookupRedeemableCode } from '@/lib/redeem-code'
import {
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
} from '@/lib/gamification/constants'
import { validatePurchasePoints } from '@/lib/gamification/purchase-points'
import { getLuckySpinForCheckout } from '@/lib/gamification/lucky-spin'
import { getMaxQty } from '@/lib/data'
import {
  computeCheckoutTotals,
  resolveCartLines,
  validateCouponPercent,
  FREE_SHIPPING_THRESHOLD,
} from '@/lib/checkout'
import { maybeSendOrderGroupConfirmationEmail } from '@/lib/order-email'
import { resolveCheckoutCoupons } from '@/lib/coupon-checkout'
import { getUserPromoCouponState } from '@/lib/promo-coupons'
import { acceptWelcomeCheckoutOffer } from '@/lib/welcome-checkout-offer'
import { finalizeOrderRewards } from '@/lib/checkout-rewards'
import { WELCOME_CHECKOUT_COUPON_PERCENT } from '@/lib/coupon-config'
import type { CouponDiscount } from '@/lib/checkout'
import {
  checkoutCustomerSchema,
  toOrderCustomerSnapshot,
} from '@/lib/checkout-customer'
import { LOCALES } from '@/i18n/locales'
import {
  CHECKOUT_PAYMENT_METHODS,
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  KLARNA_MIN_AMOUNT_HUF,
  isKlarnaEligible,
  isStripeCurrencyUnsupportedMessage,
  resolveChargeCurrency,
  resolvePaymentMode,
  toStripeUnitAmount,
} from '@/lib/checkout-payment-methods'
import { getConfiguredHufPerEur } from '@/lib/euro-rate'
import { StripeCheckoutError } from '@/lib/stripe-provider'
import {
  releasePendingCheckoutHolds,
  restoreCreatedCheckoutOrders,
} from '@/lib/stuck-payments'

const selectedCouponEnum = z.enum([
  'cat',
  'registration',
  'loyalty',
  'welcome',
  'birthday',
  'gamification',
])

const checkoutBodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(99),
        options: z
          .object({
            colorName: z.string().optional(),
            colorHex: z.string().optional(),
            materialName: z.string().optional(),
          })
          .optional(),
      })
    )
    .min(1),
  customer: checkoutCustomerSchema,
  /** Szerver validálja: ajándék- és aktivitási pont 1:1, a termékár 100%-áig. */
  pointsDiscountHuf: z.number().int().min(0).optional(),
  useGiftPoints: z.boolean().optional(),
  useActivityPoints: z.boolean().optional(),
  /** DB kupon kód – a kedvezmény % CSAK ebből / szerveroldali kuponlogikából jön. */
  couponCode: z.string().min(1).optional(),
  /** Fix Ft + százalékos kupon együtt: max. két kód. */
  couponCodes: z.array(z.string().min(1)).max(2).optional(),
  /** Checkout welcome 10% + hírlevél ajánlat (manuális kijelölés). */
  welcomeOfferAccepted: z.boolean().optional(),
  /** Manuálisan kiválasztott szerver-validált kuponok (cat/registration/welcome + opcionális fix Ft). A hűség automatikus. */
  selectedCoupons: z.array(selectedCouponEnum).max(2).optional(),
  /** Kártya, PayPal, Apple Pay, Google Pay vagy Klarna. */
  paymentMethod: z.enum(CHECKOUT_PAYMENT_METHODS).optional(),
  /** Felület nyelve – HUF (hu) / EUR (en, de, ro) terheléshez. */
  locale: z.enum(LOCALES).optional(),
})

async function stripeSessionFailedResponse(
  createdOrders: Array<{
    id: string
    orderType?: string | null
    items: { productId: string; qty: number; fulfillmentType: string }[]
  }>,
  body: { error: string; code: string; orderId: string }
) {
  try {
    const restored = await restoreCreatedCheckoutOrders(createdOrders)
    logger.info(
      { orderIds: createdOrders.map((o) => o.id), ...restored },
      'checkout: restored stock after Stripe session failure'
    )
  } catch (err) {
    logger.warn({ err }, 'checkout: stock restore after Stripe session failure failed')
  }
  return NextResponse.json(body, { status: 502 })
}

export async function POST(request: Request) {
  const idemKey = getIdempotencyKey(request)
  if (!idemKey) {
    return NextResponse.json(
      { error: 'Idempotency-Key header required', code: 'idempotency_key_required' },
      { status: 400 }
    )
  }
  const cached = await getIdempotentResponse(idemKey)
  if (cached) {
    return NextResponse.json(cached.body, {
      status: cached.status,
      headers: cached.headers,
    })
  }

  const limit = await rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429 }
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    logger.debug('checkout Invalid JSON')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = checkoutBodySchema.safeParse(raw)
  if (!parsed.success) {
    logger.debug({ details: parsed.error.flatten() }, 'checkout Validation failed')
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const {
    items,
    customer,
    pointsDiscountHuf: requestedPointsHuf = 0,
    useGiftPoints,
    useActivityPoints,
    couponCode: bodyCouponCode,
    couponCodes: bodyCouponCodes,
    welcomeOfferAccepted,
    selectedCoupons: bodySelectedCoupons,
    paymentMethod: bodyPaymentMethod,
    locale: bodyLocale,
  } = parsed.data
  const paymentMethod = bodyPaymentMethod ?? DEFAULT_CHECKOUT_PAYMENT_METHOD
  const checkoutLocale = bodyLocale ?? 'hu'
  const chargeCurrency = resolveChargeCurrency(paymentMethod, checkoutLocale)
  const fxRate = getConfiguredHufPerEur()
  const spendGift = useGiftPoints !== false
  const spendActivity = useActivityPoints !== false

  // P0: kliens discountPercent / isDiscountActive SOHA nem alkalmazható.
  // Kedvezmény csak: DB couponCode + szerveroldali selectedCoupons (cat/reg/loyalty/welcome) konstans %.
  if (
    raw &&
    typeof raw === 'object' &&
    ('discountPercent' in raw || 'isDiscountActive' in raw)
  ) {
    logger.warn(
      { hasDiscountPercent: 'discountPercent' in raw, hasIsDiscountActive: 'isDiscountActive' in raw },
      'checkout: ignoring client discountPercent/isDiscountActive (untrusted)'
    )
  }

  const collectedCouponCodes: string[] = []
  const pushCouponCode = (raw?: string) => {
    const code = raw?.trim()
    if (!code) return
    const key = code.toUpperCase()
    if (collectedCouponCodes.some((c) => c.toUpperCase() === key)) return
    collectedCouponCodes.push(code)
  }
  pushCouponCode(bodyCouponCode)
  for (const code of bodyCouponCodes ?? []) pushCouponCode(code)

  let couponCodesForCheckout = [...collectedCouponCodes]
  const selectedCoupons = new Set(bodySelectedCoupons ?? [])
  selectedCoupons.delete('loyalty')
  if (welcomeOfferAccepted === true) selectedCoupons.add('welcome')
  const wantsWelcomeOffer = selectedCoupons.has('welcome')

  let checkoutUserId: string | null = null
  const session = await getSession(request)
  if (session) {
    checkoutUserId = await resolveSessionUserId(session)
  }

  let giftPointsClaimed: {
    points: number
    expiresAt: string
    balanceAfter: number | null
  } | null = null
  const remainingCouponCodes: string[] = []
  for (const code of couponCodesForCheckout) {
    const looked = await lookupRedeemableCode(code, checkoutUserId)
    if (looked.kind === 'gift_points') {
      if (!checkoutUserId) {
        return NextResponse.json(
          { error: 'Login required to claim gift points', code: 'gift_code_login_required' },
          { status: 401 }
        )
      }
      const claimed = await claimGiftPointCode({ token: looked.token, userId: checkoutUserId })
      if (!claimed.ok) {
        const errors: Record<string, { status: number; error: string; code: string }> = {
          not_found: { status: 400, error: 'Invalid gift point code', code: 'gift_code_invalid' },
          already_used: { status: 400, error: 'Gift point code already used', code: 'gift_code_used' },
          inactive: { status: 400, error: 'Gift point code is not active', code: 'gift_code_inactive' },
          expired: { status: 400, error: 'Gift point code expired', code: 'gift_code_expired' },
          not_yet_valid: { status: 400, error: 'Gift point code is not yet valid', code: 'gift_code_not_yet_valid' },
          db_unavailable: { status: 503, error: 'Database not configured', code: 'db_unavailable' },
          grant_failed: { status: 400, error: 'Gift point claim failed', code: 'gift_code_failed' },
        }
        const mapped = errors[claimed.reason] ?? errors.grant_failed
        return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status })
      }
      giftPointsClaimed = {
        points: claimed.points,
        expiresAt: claimed.expiresAt.toISOString(),
        balanceAfter: claimed.balanceAfter,
      }
      continue
    }
    remainingCouponCodes.push(code)
  }
  couponCodesForCheckout = remainingCouponCodes

  if (requestedPointsHuf > 0) {
    if (!session || !checkoutUserId) {
      return NextResponse.json({ error: 'Login required to use points' }, { status: 401 })
    }
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId)))
  const products = await getProductsByIdsAsync(productIds)
  const productMap = new Map<string, Product>(products.map((p) => [p.id, p]))

  const now = new Date()

  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      return NextResponse.json(
        { error: 'Invalid or unknown productId', productId: item.productId },
        { status: 400 }
      )
    }
    if (product.type === 'sourcing_deal') {
      const ordersCount = await getProductOrdersCount(item.productId)
      const timedStatus = getTimedPurchaseStatus(product, now, ordersCount)
      if (timedStatus !== 'ACTIVE') {
        return NextResponse.json(
          {
            code: 'timed_offer_unavailable',
            error: 'One or more timed offers are no longer available. Please update your cart.',
          },
          { status: 400 }
        )
      }
    } else {
      const maxQty = getMaxQty(product)
      if (item.qty > maxQty) {
        return NextResponse.json(
          {
            code: 'insufficient_stock',
            error: 'One or more items exceed available stock. Please update your cart.',
            productId: item.productId,
            maxQty,
          },
          { status: 409 }
        )
      }
    }
  }

  let couponDiscount: CouponDiscount = { percent: 0 }
  let appliedCouponId: string | null = null
  let appliedSecondaryCouponId: string | null = null
  let appliedCouponCode: string | null = null

  const luckySpin = checkoutUserId ? await getLuckySpinForCheckout(checkoutUserId, now) : null
  const lines = resolveCartLines(items, productMap)

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No valid items' }, { status: 400 })
  }

  const cartSubtotalHuf = lines.reduce((s, l) => s + l.priceHuf * l.qty, 0)

  // Manuális kupon: egy % (max. 15%) + opcionális fix Ft. A hűség ettől független, automatikus.
  let combinedPercent = 0
  let fixedHufFromDb = 0
  const loyaltyEmail = (session?.email || customer.email).trim().toLowerCase()
  const loyaltyRecord = loyaltyEmail ? await getLoyaltyByEmail(loyaltyEmail) : null
  const loyaltyPercent = capLoyaltyPercent(loyaltyRecord?.loyaltyPercent ?? 0)

  if (isCatRegistrationStackBlocked(selectedCoupons)) {
    return NextResponse.json(
      {
        code: 'coupon_stack_disabled',
        error: 'Coupons cannot be combined',
      },
      { status: 400 }
    )
  }
  if (couponCodesForCheckout.length === 0 && isCouponStackingBlocked(selectedCoupons)) {
    return NextResponse.json(
      {
        code: 'coupon_stack_disabled',
        error: 'Coupons cannot be combined',
      },
      { status: 400 }
    )
  }

  if (selectedCoupons.has('cat') || selectedCoupons.has('registration')) {
    if (!checkoutUserId) {
      return NextResponse.json({ error: 'Login required for promo coupon' }, { status: 401 })
    }
    const state = await getUserPromoCouponState(checkoutUserId)
    if (selectedCoupons.has('cat')) {
      if (state.cat !== 'claimed') {
        return NextResponse.json(
          { code: 'promo_coupon_inactive', error: 'Cat coupon is not active' },
          { status: 400 }
        )
      }
      combinedPercent += CAT_COUPON_PERCENT
    }
    if (selectedCoupons.has('registration')) {
      if (state.registration !== 'claimed') {
        return NextResponse.json(
          { code: 'promo_coupon_inactive', error: 'Registration coupon is not active' },
          { status: 400 }
        )
      }
      combinedPercent += REGISTRATION_COUPON_PERCENT
    }
  }

  if (wantsWelcomeOffer) {
    const welcome = await acceptWelcomeCheckoutOffer({
      email: customer.email,
      userId: checkoutUserId,
    })
    if (!welcome.ok) {
      return NextResponse.json(
        { code: welcome.code, error: welcome.error },
        { status: 400 }
      )
    }
    combinedPercent += welcome.percent || WELCOME_CHECKOUT_COUPON_PERCENT
  }

  if (couponCodesForCheckout.length > 0) {
    const resolved = await resolveCheckoutCoupons({
      couponCodes: couponCodesForCheckout,
      checkoutUserId,
      subtotalHuf: cartSubtotalHuf,
      now,
    })
    if (!resolved.ok) {
      return NextResponse.json({ code: resolved.code, error: resolved.error }, { status: 400 })
    }
    appliedCouponId = resolved.result.primaryCouponId
    appliedSecondaryCouponId = resolved.result.secondaryCouponId
    appliedCouponCode = resolved.result.coupons[0]?.coupon.code ?? null
    const fixedIds: string[] = []
    for (const entry of resolved.result.coupons) {
      if (entry.coupon.source === 'gamification') {
        selectedCoupons.add('gamification')
        if (isFixedCouponDiscount(entry.discount)) fixedIds.push('gamification')
      } else if (entry.coupon.source === 'birthday') {
        selectedCoupons.add('birthday')
        if (isFixedCouponDiscount(entry.discount)) fixedIds.push('birthday')
      } else if (isFixedCouponDiscount(entry.discount)) {
        selectedCoupons.add('gamification')
        fixedIds.push('gamification')
      }
    }
    if (isCouponStackingBlocked(selectedCoupons, { fixedIds })) {
      return NextResponse.json(
        {
          code: 'coupon_stack_disabled',
          error: 'Coupons cannot be combined',
        },
        { status: 400 }
      )
    }
    if (resolved.result.percent > 0) {
      const otherPercentFlags = Array.from(selectedCoupons).filter(
        (id) => id !== 'birthday' && id !== 'gamification' && id !== 'loyalty'
      )
      if (otherPercentFlags.length > 0) {
        return NextResponse.json(
          {
            code: 'coupon_stack_disabled',
            error: 'Coupons cannot be combined',
          },
          { status: 400 }
        )
      }
    }
    fixedHufFromDb = resolved.result.fixedHuf
    if (resolved.result.percent > 0) {
      combinedPercent += resolved.result.percent
    }
  }

  const cappedPercent = capCombinedCouponPercent(combinedPercent)
  if (!validateCouponPercent(cappedPercent, Boolean(checkoutUserId) || wantsWelcomeOffer || couponCodesForCheckout.length > 0)) {
    return NextResponse.json({ error: 'Invalid coupon discount' }, { status: 400 })
  }

  const hasPromoSelection =
    selectedCoupons.size > 0 ||
    couponCodesForCheckout.length > 0 ||
    cappedPercent > 0 ||
    fixedHufFromDb > 0
  if (requestedPointsHuf > 0 && hasPromoSelection) {
    return NextResponse.json(
      {
        code: 'points_promo_stack_disabled',
        error: 'Points cannot be combined with other promotions or coupons',
      },
      { status: 400 }
    )
  }

  couponDiscount = {
    percent: cappedPercent,
    ...(fixedHufFromDb > 0 ? { fixedHuf: fixedHufFromDb } : {}),
  }

  if (loyaltyPercent > 0) selectedCoupons.add('loyalty')

  const prePointsTotals = computeCheckoutTotals({
    lines,
    coupon: couponDiscount,
    luckySpin,
    loyaltyPercent,
    now,
  })

  let validatedPointsHuf = 0
  let giftPointsAvailable = 0
  if (requestedPointsHuf > 0 && checkoutUserId && (spendGift || spendActivity)) {
    const validation = await validatePurchasePoints(
      checkoutUserId,
      prePointsTotals.afterCouponAndLuckyHuf,
      requestedPointsHuf,
      { spendGift, spendActivity }
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    validatedPointsHuf = validation.pointsDiscountHuf
    giftPointsAvailable = await getAvailableGiftPoints(checkoutUserId)
  }

  const totals = computeCheckoutTotals({
    lines,
    coupon: couponDiscount,
    luckySpin,
    loyaltyPercent,
    points:
      validatedPointsHuf > 0 && checkoutUserId
        ? {
            requestedDiscountHuf: validatedPointsHuf,
            userBalance: await getPointBalance(checkoutUserId),
            giftPointsAvailable,
            spendGift,
            spendActivity,
          }
        : undefined,
    now,
  })

  const { inStock, sourcing, luckySpin: luckySpinDiscount } = totals
  const combinedMerchandise = totals.merchandiseTotalHuf

  if (combinedMerchandise <= 0 && totals.subtotalHuf <= 0) {
    return NextResponse.json({ error: 'No valid items or invalid total' }, { status: 400 })
  }

  const hasInStock = inStock.items.length > 0
  const hasSourcing = sourcing.items.length > 0

  if (!hasInStock && !hasSourcing) {
    return NextResponse.json({ error: 'No valid items or invalid total' }, { status: 400 })
  }

  if (paymentMethod === 'klarna' && !isKlarnaEligible(totals.finalTotalHuf)) {
    return NextResponse.json(
      {
        error: 'Klarna instalments require a higher order total',
        code: 'klarna_min_amount',
        minAmountHuf: KLARNA_MIN_AMOUNT_HUF,
      },
      { status: 400 }
    )
  }

  let reservationIds: string[] = []
  if (hasSourcing && sourcing.items.length > 0) {
    try {
      reservationIds = await reserveSourcingSlots(
        sourcing.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        (productId) => productMap.get(productId)?.maxOrders ?? 0
      )
    } catch (err) {
      if (err instanceof SoldOutError) {
        return NextResponse.json({ error: 'Sold out' }, { status: 409 })
      }
      throw err
    }
  }

  const orderGroupId = generateOrderGroupId()
  const provider = getPaymentProvider()
  /** Rendelés belső elszámolása HUF; a Stripe-terhelés HUF vagy EUR. */
  const currency = 'huf'
  const customerSnapshot = toOrderCustomerSnapshot(customer)

  const appliedCouponsList = Array.from(selectedCoupons)
  const checkoutOrderParams = {
    orderGroupId,
    userId: checkoutUserId ?? undefined,
    couponId: appliedCouponId ?? undefined,
    secondaryCouponId: appliedSecondaryCouponId ?? undefined,
    appliedCoupons: appliedCouponsList,
    paymentMethod,
    customer: customerSnapshot,
    inStock: hasInStock
      ? {
          items: inStock.items,
          subtotalHuf: inStock.subtotalHuf,
          discountHuf: inStock.couponDiscountHuf + inStock.luckySpinDiscountHuf,
          totalHuf: Math.max(0, inStock.totalHuf),
          pointsDiscountHuf: inStock.pointsDiscountHuf,
          pointsUsed: inStock.pointsUsed,
          giftPointsUsed: inStock.giftPointsUsed,
        }
      : undefined,
    sourcing: hasSourcing
      ? {
          items: sourcing.items,
          subtotalHuf: sourcing.subtotalHuf,
          discountHuf: sourcing.couponDiscountHuf + sourcing.luckySpinDiscountHuf,
          totalHuf: Math.max(0, sourcing.totalHuf),
          pointsDiscountHuf: sourcing.pointsDiscountHuf,
          pointsUsed: sourcing.pointsUsed,
          giftPointsUsed: sourcing.giftPointsUsed,
        }
      : undefined,
    currency,
  }

  let createdOrders
  try {
    try {
      createdOrders = await createCheckoutOrders(checkoutOrderParams)
    } catch (err) {
      if (!(err instanceof OutOfStockException)) throw err
      const released = await releasePendingCheckoutHolds({
        userId: checkoutUserId,
        customerEmail: customerSnapshot.email,
      })
      if (released.cancelled === 0) throw err
      logger.info(
        {
          userId: checkoutUserId,
          email: customerSnapshot.email,
          cancelled: released.cancelled,
          stockRestored: released.stockRestored,
          productId: err.productId,
        },
        'checkout: released pending holds after out_of_stock, retrying'
      )
      createdOrders = await createCheckoutOrders(checkoutOrderParams)
    }
  } catch (err) {
    if (reservationIds.length > 0) {
      try {
        const { prisma, isDbConfigured } = await import('@/lib/prisma')
        if (isDbConfigured()) {
          await prisma.productReservation.updateMany({
            where: { id: { in: reservationIds }, status: 'RESERVED' },
            data: { status: 'CANCELED' },
          })
        }
      } catch {
        // ignore cleanup errors
      }
    }
    if (err instanceof OutOfStockException) {
      return NextResponse.json(
        { error: 'Out of stock', productId: err.productId, code: 'out_of_stock' },
        { status: 409 }
      )
    }
    logger.error({ err, paymentMethod }, 'checkout: createCheckoutOrders failed')
    const message = err instanceof Error ? err.message : 'Could not create order'
    return NextResponse.json(
      { error: message, code: 'checkout_order_failed' },
      { status: 500 }
    )
  }

  const sourcingOrder = createdOrders.find((o) => o.orderType === 'sourcing')
  if (sourcingOrder && reservationIds.length > 0) {
    await linkReservationsToOrder(reservationIds, sourcingOrder.id)
  }

  const paymentResults: Array<{
    orderId: string
    orderType: 'in_stock' | 'sourcing'
    mode: 'capture' | 'authorize'
    transactionId?: string
    type: 'redirect' | 'client_secret' | 'pending'
    url?: string
    clientSecret?: string
    message?: string
  }> = []

  for (const order of createdOrders) {
    if (order.totalHuf === 0 && (order.pointsUsed ?? 0) > 0) {
      await setOrderStatus(order.id, 'paid')
      try {
        await finalizeOrderRewards(order.id)
      } catch (err) {
        logger.error({ err, orderId: order.id }, 'checkout: finalizeOrderRewards failed (points-only)')
      }
      paymentResults.push({
        orderId: order.id,
        orderType: order.orderType!,
        mode: 'capture',
        type: 'pending',
        message: 'Paid with points only',
      })
      continue
    }

    const mode = resolvePaymentMode(order.orderType!, paymentMethod)
    const isCapture = mode === 'capture'
    let usedCurrency = chargeCurrency
    let usedAmount = toStripeUnitAmount(order.totalHuf, usedCurrency, fxRate)
    const tx = await createPaymentTransaction({
      orderId: order.id,
      provider: provider.name,
      mode,
      amount: usedAmount,
      currency: usedCurrency,
      status: 'pending',
    })
    let usedTxId = tx.id

    const paymentParams = (transactionId: string, amount: number, currency: typeof usedCurrency) => ({
      transactionId,
      amount,
      currency,
      orderId: order.id,
      orderGroupId,
      customer: { email: customerSnapshot.email, name: customerSnapshot.name },
      paymentMethod,
      locale: checkoutLocale,
    })

    let result
    try {
      const first = paymentParams(usedTxId, usedAmount, usedCurrency)
      result = isCapture
        ? await provider.createCapturePayment(first)
        : await provider.createAuthorizationPayment(first)
    } catch (err) {
      const stripeErr = err instanceof StripeCheckoutError ? err : null
      const message = stripeErr?.message || (err instanceof Error ? err.message : '')
      if (usedCurrency === 'huf' && isStripeCurrencyUnsupportedMessage(message)) {
        logger.warn({ err, orderId: order.id, paymentMethod }, 'checkout: HUF Stripe session failed, retrying EUR')
        usedCurrency = 'eur'
        usedAmount = toStripeUnitAmount(order.totalHuf, 'eur', fxRate)
        const eurTx = await createPaymentTransaction({
          orderId: order.id,
          provider: provider.name,
          mode,
          amount: usedAmount,
          currency: 'eur',
          status: 'pending',
        })
        usedTxId = eurTx.id
        try {
          const retry = paymentParams(usedTxId, usedAmount, 'eur')
          result = isCapture
            ? await provider.createCapturePayment(retry)
            : await provider.createAuthorizationPayment(retry)
        } catch (retryErr) {
          const retryStripe = retryErr instanceof StripeCheckoutError ? retryErr : null
          logger.error(
            { err: retryErr, orderId: order.id, paymentMethod },
            'checkout: EUR Stripe session retry failed'
          )
          return stripeSessionFailedResponse(createdOrders, {
            error: retryStripe?.message || 'Could not start Stripe Checkout',
            code: retryStripe?.code || 'stripe_session_failed',
            orderId: order.id,
          })
        }
      } else {
        logger.error(
          { err, orderId: order.id, paymentMethod },
          'checkout: payment session create failed'
        )
        return stripeSessionFailedResponse(createdOrders, {
          error: stripeErr?.message || 'Could not start Stripe Checkout',
          code: stripeErr?.code || 'stripe_session_failed',
          orderId: order.id,
        })
      }
    }

    if (result.type === 'redirect') {
      paymentResults.push({
        orderId: order.id,
        orderType: order.orderType!,
        mode,
        transactionId: usedTxId,
        type: 'redirect',
        url: result.url,
      })
    } else if (result.type === 'client_secret') {
      paymentResults.push({
        orderId: order.id,
        orderType: order.orderType!,
        mode,
        transactionId: usedTxId,
        type: 'client_secret',
        clientSecret: result.clientSecret,
      })
    } else {
      paymentResults.push({
        orderId: order.id,
        orderType: order.orderType!,
        mode,
        transactionId: usedTxId,
        type: 'pending',
        message: result.message,
      })
    }
  }

  logger.debug(
    { orderGroupId, orderCount: createdOrders.length, paymentCount: paymentResults.length },
    'checkout completed'
  )

  const needsExternalPayment = paymentResults.some(
    (p) => p.type === 'redirect' || p.type === 'client_secret'
  )
  // Dummy / pending provider: nincs Stripe redirect → azonnal paid + kupon/pont égetés
  if (!needsExternalPayment && createdOrders.length > 0) {
    try {
      const { confirmPendingAndFinalizeOrderGroup } = await import('@/lib/checkout-rewards')
      await confirmPendingAndFinalizeOrderGroup(orderGroupId)
    } catch (err) {
      logger.error({ err, orderGroupId }, 'checkout: confirmPendingAndFinalizeOrderGroup failed')
    }
    try {
      const emailResult = await maybeSendOrderGroupConfirmationEmail(
        createdOrders[0]!.id,
        customerSnapshot.email
      )
      if (!emailResult.ok) {
        logger.error({ err: emailResult.error }, 'checkout: order confirmation email failed')
      }
    } catch (emailErr) {
      logger.error({ err: emailErr }, 'checkout: order confirmation email error')
    }
  }

  const payload = {
    orderGroupId,
    payments: paymentResults,
    giftPointsClaimed: giftPointsClaimed ?? undefined,
    luckySpinApplied: luckySpinDiscount.active
      ? {
          discountHuf: luckySpinDiscount.discountHuf,
          qualifyingItemCount: luckySpinDiscount.qualifyingItemCount,
        }
      : undefined,
    pointsApplied: totals.pointsDiscountHuf > 0
      ? {
          pointsDiscountHuf: totals.pointsDiscountHuf,
          pointsUsed: totals.pointsUsed,
          giftPointsUsed: totals.giftPointsUsed,
          activityPointsUsed: totals.activityPointsUsed,
          cardTotalHuf: totals.finalTotalHuf,
          invoiceMerchandiseHuf: totals.invoiceMerchandiseHuf,
          invoiceShippingHuf: totals.invoiceShippingHuf,
          invoiceTotalHuf: totals.invoiceTotalHuf,
          maxPointsDiscountHuf: Math.floor(totals.afterCouponAndLuckyHuf * MAX_CART_POINTS_COVERAGE),
          pointsPerHuf: POINTS_PER_HUF,
          maxCoveragePercent: MAX_CART_POINTS_COVERAGE,
        }
      : undefined,
    shipping: {
      shippingHuf: totals.shippingHuf,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      freeShippingRemainingHuf: totals.freeShippingRemainingHuf,
    },
    totals: {
      subtotalHuf: totals.subtotalHuf,
      couponDiscountHuf: totals.couponDiscountHuf,
      luckySpinDiscountHuf: totals.luckySpinDiscountHuf,
      merchandiseTotalHuf: totals.merchandiseTotalHuf,
      finalTotalHuf: totals.finalTotalHuf,
      invoiceMerchandiseHuf: totals.invoiceMerchandiseHuf,
      invoiceShippingHuf: totals.invoiceShippingHuf,
      invoiceTotalHuf: totals.invoiceTotalHuf,
    },
  }
  await setIdempotentResponse(idemKey, payload, 200)
  return NextResponse.json(payload)
}
