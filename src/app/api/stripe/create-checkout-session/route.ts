import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { getProductsByIdsAsync, getTimedPurchaseStatus } from '@/lib/data'
import type { Product } from '@/lib/data'
import { createOrder, getProductOrdersCount, type OrderItem } from '@/lib/orders'
import { getLoyaltyByEmail } from '@/lib/loyalty'
import { rateLimit } from '@/lib/rate-limit'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

const DEFAULT_DISCOUNT_PERCENT = 0.05

const createCheckoutBodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(99),
      })
    )
    .min(1),
  isDiscountActive: z.boolean(),
  discountPercent: z.number().min(0).max(1).optional(),
  customer_email: z.string().email().optional().nullable(),
})

type CartItemInput = z.infer<typeof createCheckoutBodySchema>['items'][number]

/** Backend validálja az árat: termékek és kedvezmény alapján. */
function computeTotals(
  items: CartItemInput[],
  isDiscountActive: boolean,
  discountPercent: number,
  productMap: Map<string, Product>
): { orderItems: OrderItem[]; subtotalHuf: number; discountHuf: number; totalHuf: number } {
  let subtotalHuf = 0
  const orderItems: OrderItem[] = []

  for (const { productId, qty } of items) {
    const product = productMap.get(productId)
    if (!product || qty < 1) continue
    const priceHuf = product.discountPriceHuf ?? product.priceHuf
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

  const discountHuf = isDiscountActive ? Math.round(subtotalHuf * discountPercent) : 0
  const totalHuf = subtotalHuf - discountHuf
  return { orderItems, subtotalHuf, discountHuf, totalHuf }
}

export async function POST(request: Request) {
  const limit = await rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 })
  }
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 501 }
    )
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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

  const { items, isDiscountActive, discountPercent: bodyPercent, customer_email } = parsed.data
  const productIds = Array.from(new Set(items.map((i) => i.productId)))
  const products = await getProductsByIdsAsync(productIds)
  const productMap = new Map<string, Product>(products.map((p) => [p.id, p]))

  // Kupon elsőbbség; ha nincs kupon, hűségkedvezmény email alapján (nem összevonható)
  let effectiveDiscountActive = false
  let effectiveDiscountPercent = 0
  if (isDiscountActive && bodyPercent != null && bodyPercent > 0) {
    effectiveDiscountActive = true
    effectiveDiscountPercent = bodyPercent
  } else if (customer_email) {
    const loyalty = getLoyaltyByEmail(customer_email)
    if (loyalty && loyalty.loyaltyPercent > 0) {
      effectiveDiscountActive = true
      effectiveDiscountPercent = loyalty.loyaltyPercent / 100
    }
  }

  const now = new Date()
  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      return NextResponse.json(
        { error: 'Invalid or unknown productId' },
        { status: 400 }
      )
    }
    if (product.type === 'sourcing_deal') {
      const ordersCount = await getProductOrdersCount(item.productId)
      const timedStatus = getTimedPurchaseStatus(product, now, ordersCount)
      if (timedStatus !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'One or more timed offers are no longer available (not started or expired). Please update your cart.' },
          { status: 400 }
        )
      }
    }
  }

  const { orderItems, subtotalHuf, discountHuf, totalHuf } = computeTotals(
    items,
    effectiveDiscountActive,
    effectiveDiscountPercent,
    productMap
  )
  if (orderItems.length === 0 || totalHuf <= 0) {
    return NextResponse.json(
      { error: 'No valid items or invalid total' },
      { status: 400 }
    )
  }

  const order = await createOrder({
    items: orderItems,
    subtotalHuf,
    discountHuf,
    totalHuf,
    currency: 'huf',
  })

  // Stripe HUF: zero-decimal – unit_amount forintban (egész), nem fillér
  const useStripeCoupon =
    discountHuf > 0 &&
    isDiscountActive &&
    Math.abs(effectiveDiscountPercent - 0.05) < 0.001 &&
    process.env.STRIPE_COUPON_ID_5PERCENT
  const unitPriceMultiplier = useStripeCoupon ? 1 : discountHuf > 0 ? 1 - effectiveDiscountPercent : 1

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = orderItems.map(
    (item) => ({
      price_data: {
        currency: 'huf',
        product_data: {
          name: item.name || item.productId,
        },
        unit_amount: Math.round(item.priceHuf * unitPriceMultiplier),
      },
      quantity: item.qty,
    })
  )

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

  if (useStripeCoupon) {
    sessionParams.discounts = [
      { coupon: process.env.STRIPE_COUPON_ID_5PERCENT! },
    ]
  }

  if (customer_email) {
    sessionParams.customer_email = customer_email
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout session error:', err)
    return NextResponse.json(
      { error: 'Could not create checkout session' },
      { status: 500 }
    )
  }
}
