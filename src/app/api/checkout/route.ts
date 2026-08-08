import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProductByIdAsync, getTimedPurchaseStatus } from '@/lib/data'
import type { Product } from '@/lib/data'
import {
  generateOrderGroupId,
  createCheckoutOrders,
  setOrderCustomerEmail,
  setOrderStatus,
  getProductOrdersCount,
} from '@/lib/orders'
import {
  createPaymentTransaction,
  updatePaymentTransactionStatus,
} from '@/lib/payment-transactions'
import { getPaymentProvider } from '@/lib/payment-provider'
import { getLoyaltyByEmail } from '@/lib/loyalty'
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
import {
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
} from '@/lib/gamification/constants'
import { validatePurchasePoints } from '@/lib/gamification/purchase-points'
import { enqueueOrderPurchasePointsRedemption } from '@/lib/gamification/order-points'
import { getLuckySpinForCheckout } from '@/lib/gamification/lucky-spin'
import { getMaxQty } from '@/lib/data'
import {
  computeCheckoutTotals,
  resolveCartLines,
  validateCouponPercent,
  FREE_SHIPPING_THRESHOLD,
} from '@/lib/checkout'
import { maybeSendOrderGroupConfirmationEmail } from '@/lib/order-email'
import { resolveCheckoutCoupon, recordCouponUsageOnPayment } from '@/lib/coupon-checkout'
import { getActivePromoDiscountPercent } from '@/lib/promo-coupons'
import { acceptWelcomeCheckoutOffer } from '@/lib/welcome-checkout-offer'
import { WELCOME_CHECKOUT_COUPON_PERCENT } from '@/lib/coupon-config'
import type { CouponDiscount } from '@/lib/checkout'

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
  customer: z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }),
  isDiscountActive: z.boolean().optional(),
  discountPercent: z.number().min(0).max(1).optional(),
  /** Szerver validálja: max. kosár 30%-a, egyenleg ellenőrzés. */
  pointsDiscountHuf: z.number().int().min(0).optional(),
  /** DB kupon kód – nem kombinálható macska/regisztrációs kuponnal vagy loyalty-val. */
  couponCode: z.string().min(1).optional(),
  /**
   * Checkout welcome 10% + hírlevél ajánlat (vendégnek is).
   * Nem kombinálható más kliens kuponnal / kuponkóddal.
   */
  welcomeOfferAccepted: z.boolean().optional(),
})

export async function POST(request: Request) {
  const idemKey = getIdempotencyKey(request)
  if (idemKey) {
    const cached = getIdempotentResponse(idemKey)
    if (cached) {
      return NextResponse.json(cached.body, {
        status: cached.status,
        headers: cached.headers,
      })
    }
  }

  const limit = rateLimit(request)
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
    isDiscountActive,
    discountPercent: bodyPercent,
    pointsDiscountHuf: requestedPointsHuf = 0,
    couponCode: bodyCouponCode,
    welcomeOfferAccepted,
  } = parsed.data

  const couponCodeTrimmed = bodyCouponCode?.trim() ?? ''
  const hasClientCoupon = Boolean(isDiscountActive && bodyPercent != null && bodyPercent > 0)
  const wantsWelcomeOffer = welcomeOfferAccepted === true

  if (couponCodeTrimmed && hasClientCoupon) {
    return NextResponse.json(
      {
        code: 'coupon_conflict',
        error: 'A kuponkód nem kombinálható a macska vagy regisztrációs kuponnal.',
      },
      { status: 400 }
    )
  }
  if (wantsWelcomeOffer && (hasClientCoupon || couponCodeTrimmed)) {
    return NextResponse.json(
      {
        code: 'coupon_conflict',
        error: 'A welcome 10% hírlevél-kedvezmény nem kombinálható más kuponnal.',
      },
      { status: 400 }
    )
  }

  let checkoutUserId: string | null = null
  const session = await getSession(request)
  if (session) {
    checkoutUserId = await resolveSessionUserId(session)
  }
  if (requestedPointsHuf > 0) {
    if (!session || !checkoutUserId) {
      return NextResponse.json({ error: 'Login required to use points' }, { status: 401 })
    }
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId)))
  const productMap = new Map<string, Product>()
  for (const id of productIds) {
    const p = await getProductByIdAsync(id)
    if (p) productMap.set(id, p)
  }

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
  let appliedCouponCode: string | null = null

  const luckySpin = checkoutUserId ? await getLuckySpinForCheckout(checkoutUserId, now) : null
  const lines = resolveCartLines(items, productMap)

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No valid items' }, { status: 400 })
  }

  const cartSubtotalHuf = lines.reduce((s, l) => s + l.priceHuf * l.qty, 0)

  if (couponCodeTrimmed) {
    const resolved = await resolveCheckoutCoupon({
      couponCode: couponCodeTrimmed,
      checkoutUserId,
      subtotalHuf: cartSubtotalHuf,
      now,
    })
    if (!resolved.ok) {
      return NextResponse.json({ code: resolved.code, error: resolved.error }, { status: 400 })
    }
    couponDiscount = resolved.discount
    appliedCouponId = resolved.coupon.id
    appliedCouponCode = resolved.coupon.code
  } else if (wantsWelcomeOffer) {
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
    const percent = welcome.percent || WELCOME_CHECKOUT_COUPON_PERCENT
    if (!validateCouponPercent(percent, true)) {
      return NextResponse.json({ error: 'Invalid welcome coupon discount' }, { status: 400 })
    }
    couponDiscount = { percent }
  } else if (hasClientCoupon) {
    if (!checkoutUserId) {
      return NextResponse.json({ error: 'Login required for promo coupon' }, { status: 401 })
    }
    const serverPercent = await getActivePromoDiscountPercent(checkoutUserId)
    if (serverPercent <= 0) {
      return NextResponse.json(
        { code: 'promo_coupon_inactive', error: 'No active promo coupon on this account' },
        { status: 400 }
      )
    }
    if (!validateCouponPercent(serverPercent, true)) {
      return NextResponse.json({ error: 'Invalid coupon discount' }, { status: 400 })
    }
    couponDiscount = { percent: serverPercent }
  } else if (!isDiscountActive) {
    const loyalty = getLoyaltyByEmail(customer.email)
    if (loyalty && loyalty.loyaltyPercent > 0) {
      couponDiscount = { percent: loyalty.loyaltyPercent / 100 }
    }
  }

  const prePointsTotals = computeCheckoutTotals({
    lines,
    coupon: couponDiscount,
    luckySpin,
    now,
  })

  let validatedPointsHuf = 0
  if (requestedPointsHuf > 0 && checkoutUserId) {
    const validation = await validatePurchasePoints(
      checkoutUserId,
      prePointsTotals.afterCouponAndLuckyHuf,
      requestedPointsHuf
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    validatedPointsHuf = validation.pointsDiscountHuf
  }

  const totals = computeCheckoutTotals({
    lines,
    coupon: couponDiscount,
    luckySpin,
    points:
      validatedPointsHuf > 0 && checkoutUserId
        ? {
            requestedDiscountHuf: validatedPointsHuf,
            userBalance: await getPointBalance(checkoutUserId),
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
  const currency = 'huf'

  const createdOrders = await createCheckoutOrders({
    orderGroupId,
    userId: checkoutUserId ?? undefined,
    couponId: appliedCouponId ?? undefined,
    inStock: hasInStock
      ? {
          items: inStock.items,
          subtotalHuf: inStock.subtotalHuf,
          discountHuf: inStock.couponDiscountHuf + inStock.luckySpinDiscountHuf,
          totalHuf: Math.max(0, inStock.totalHuf),
          pointsDiscountHuf: inStock.pointsDiscountHuf,
          pointsUsed: inStock.pointsUsed,
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
        }
      : undefined,
    currency,
  })

  for (const order of createdOrders) {
    await setOrderCustomerEmail(order.id, customer.email)
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
      await recordCouponUsageOnPayment(order.id)
      if (wantsWelcomeOffer) {
        try {
          const { markWelcomeCouponRedeemed } = await import('@/lib/welcome-checkout-offer')
          await markWelcomeCouponRedeemed(customer.email)
        } catch {
          /* non-fatal */
        }
      }
      if (checkoutUserId) {
        try {
          const { markUserPromoCouponsUsed } = await import('@/lib/promo-coupons')
          await markUserPromoCouponsUsed(checkoutUserId)
        } catch {
          /* non-fatal */
        }
      }
      await enqueueOrderPurchasePointsRedemption({
        id: order.id,
        userId: order.userId ?? checkoutUserId,
        pointsUsed: order.pointsUsed ?? 0,
        pointsDiscountHuf: order.pointsDiscountHuf ?? 0,
      })
      paymentResults.push({
        orderId: order.id,
        orderType: order.orderType!,
        mode: 'capture',
        type: 'pending',
        message: 'Paid with points only',
      })
      continue
    }

    const isCapture = order.orderType === 'in_stock'
    const mode = isCapture ? 'capture' : 'authorize'
    const tx = createPaymentTransaction({
      orderId: order.id,
      provider: provider.name,
      mode,
      amount: order.totalHuf,
      currency,
    })
    updatePaymentTransactionStatus(tx.id, 'pending')

    const params = {
      transactionId: tx.id,
      amount: order.totalHuf,
      currency,
      orderId: order.id,
      orderGroupId,
      customer: { email: customer.email, name: customer.name },
    }

    let result
    if (isCapture) {
      result = await provider.createCapturePayment(params)
    } else {
      result = await provider.createAuthorizationPayment(params)
    }

    if (result.type === 'redirect') {
      paymentResults.push({
        orderId: order.id,
        orderType: order.orderType!,
        mode,
        transactionId: tx.id,
        type: 'redirect',
        url: result.url,
      })
    } else if (result.type === 'client_secret') {
      paymentResults.push({
        orderId: order.id,
        orderType: order.orderType!,
        mode,
        transactionId: tx.id,
        type: 'client_secret',
        clientSecret: result.clientSecret,
      })
    } else {
      paymentResults.push({
        orderId: order.id,
        orderType: order.orderType!,
        mode,
        transactionId: tx.id,
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
  if (!needsExternalPayment && createdOrders.length > 0) {
    try {
      const emailResult = await maybeSendOrderGroupConfirmationEmail(
        createdOrders[0]!.id,
        customer.email
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
    couponApplied: appliedCouponCode
      ? { code: appliedCouponCode, discountHuf: totals.couponDiscountHuf }
      : undefined,
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
          cardTotalHuf: totals.finalTotalHuf,
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
    },
  }
  if (idemKey) {
    setIdempotentResponse(idemKey, payload, 200)
  }
  return NextResponse.json(payload)
}
