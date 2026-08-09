/**
 * @deprecated Használd helyette POST /api/checkout – a StripeProvider integrációval.
 * Ez a route a régi, egyszeres rendeléses Stripe Checkout flow-t szolgálja ki.
 * P0: kliens discountPercent NEM megbízható – csak couponCode (DB) ad kedvezményt.
 */
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { getProductsByIdsAsync, getTimedPurchaseStatus } from '@/lib/data'
import type { Product } from '@/lib/data'
import { isSaleActive } from '@/lib/storefront-config'
import { createOrder, getProductOrdersCount, type OrderItem } from '@/lib/orders'
import { rateLimit } from '@/lib/rate-limit'
import { resolvePublicAppUrl } from '@/lib/bootstrap-auth-env'
import { resolveCheckoutCoupon } from '@/lib/coupon-checkout'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import {
  getIdempotencyKey,
  getIdempotentResponse,
  setIdempotentResponse,
} from '@/lib/idempotency'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

const createCheckoutBodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(99),
      })
    )
    .min(1),
  /** @deprecated ignored – soha nem alkalmazzuk a kliens percentet */
  isDiscountActive: z.boolean().optional(),
  /** @deprecated ignored – soha nem alkalmazzuk */
  discountPercent: z.number().min(0).max(1).optional(),
  /** DB kupon kód – egyedüli kedvezményforrás ezen a legacy route-on */
  couponCode: z.string().min(1).optional(),
  customer_email: z.string().email().optional().nullable(),
})

type CartItemInput = z.infer<typeof createCheckoutBodySchema>['items'][number]

function computeTotals(
  items: CartItemInput[],
  discountPercent: number,
  fixedHuf: number,
  productMap: Map<string, Product>
): { orderItems: OrderItem[]; subtotalHuf: number; discountHuf: number; totalHuf: number } {
  let subtotalHuf = 0
  const orderItems: OrderItem[] = []

  for (const { productId, qty } of items) {
    const product = productMap.get(productId)
    if (!product || qty < 1) continue
    const priceHuf =
      isSaleActive(product) && product.discountPriceHuf != null
        ? product.discountPriceHuf
        : product.priceHuf
    const lineTotal = priceHuf * qty
    subtotalHuf += lineTotal
    orderItems.push({
      productId,
      qty,
      fulfillmentType: product.type === 'sourcing_deal' ? 'procurement' : 'stock',
      priceHuf,
      name: product.name,
    })
  }

  const percentDiscount = discountPercent > 0 ? Math.round(subtotalHuf * discountPercent) : 0
  const discountHuf = Math.min(subtotalHuf, percentDiscount + Math.max(0, fixedHuf))
  const totalHuf = subtotalHuf - discountHuf
  return { orderItems, subtotalHuf, discountHuf, totalHuf }
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
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 })
  }
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 501 })
  }
  const appUrl = resolvePublicAppUrl()

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createCheckoutBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { items, couponCode, customer_email } = parsed.data
  const productIds = Array.from(new Set(items.map((i) => i.productId)))
  const products = await getProductsByIdsAsync(productIds)
  const productMap = new Map<string, Product>(products.map((p) => [p.id, p]))

  // P0: kliens percent ignorálva – kedvezmény csak DB couponCode-ból
  let effectiveDiscountPercent = 0
  let fixedHuf = 0
  const couponCodeTrimmed = couponCode?.trim() ?? ''
  if (couponCodeTrimmed) {
    let checkoutUserId: string | null = null
    const session = await getSession(request)
    if (session) checkoutUserId = await resolveSessionUserId(session)

    const subtotalPreview = items.reduce((s, i) => {
      const p = productMap.get(i.productId)
      if (!p) return s
      const unit =
        isSaleActive(p) && p.discountPriceHuf != null ? p.discountPriceHuf : p.priceHuf
      return s + unit * i.qty
    }, 0)

    const resolved = await resolveCheckoutCoupon({
      couponCode: couponCodeTrimmed,
      checkoutUserId,
      subtotalHuf: subtotalPreview,
    })
    if (!resolved.ok) {
      return NextResponse.json({ code: resolved.code, error: resolved.error }, { status: 400 })
    }
    if (resolved.discount.fixedHuf && resolved.discount.fixedHuf > 0) {
      fixedHuf = resolved.discount.fixedHuf
    } else if (resolved.discount.percent && resolved.discount.percent > 0) {
      effectiveDiscountPercent = resolved.discount.percent
    }
  }

  const now = new Date()
  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      return NextResponse.json({ error: 'Invalid or unknown productId' }, { status: 400 })
    }
    if (product.type === 'sourcing_deal') {
      const ordersCount = await getProductOrdersCount(item.productId)
      const timedStatus = getTimedPurchaseStatus(product, now, ordersCount)
      if (timedStatus !== 'ACTIVE') {
        return NextResponse.json(
          {
            error:
              'One or more timed offers are no longer available (not started or expired). Please update your cart.',
          },
          { status: 400 }
        )
      }
    }
  }

  const { orderItems, subtotalHuf, discountHuf, totalHuf } = computeTotals(
    items,
    effectiveDiscountPercent,
    fixedHuf,
    productMap
  )
  if (orderItems.length === 0 || totalHuf <= 0) {
    return NextResponse.json({ error: 'No valid items or invalid total' }, { status: 400 })
  }

  const order = await createOrder({
    items: orderItems,
    subtotalHuf,
    discountHuf,
    totalHuf,
    currency: 'huf',
  })

  const unitPriceMultiplier =
    discountHuf > 0 && subtotalHuf > 0 ? Math.max(0, 1 - discountHuf / subtotalHuf) : 1

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = orderItems.map((item) => ({
    price_data: {
      currency: 'huf',
      product_data: {
        name: item.name || item.productId,
      },
      unit_amount: Math.round(item.priceHuf * unitPriceMultiplier),
    },
    quantity: item.qty,
  }))

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items,
    success_url: `${appUrl}/fizetes/siker?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/fizetes/megszakitva`,
    metadata: {
      orderId: order.id,
    },
    payment_method_types: ['card'],
  }

  if (customer_email) {
    sessionParams.customer_email = customer_email
  }

  const session = await stripe.checkout.sessions.create(sessionParams)
  const payload = { url: session.url, sessionId: session.id, orderId: order.id }
  await setIdempotentResponse(idemKey, payload, 200)
  return NextResponse.json(payload)
}
