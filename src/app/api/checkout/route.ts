import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProductsByIdsAsync, getTimedPurchaseStatus } from '@/lib/data'
import type { Product } from '@/lib/data'
import {
  generateOrderGroupId,
  createCheckoutOrders,
  setOrderCustomerEmail,
  getProductOrdersCount,
  OutOfStockException,
  type OrderItem,
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
})

type CartItemInput = z.infer<typeof checkoutBodySchema>['items'][number]

function splitCartAndComputeTotals(
  items: CartItemInput[],
  discountPercent: number,
  productMap: Map<string, Product>
): {
  inStock: { items: OrderItem[]; subtotalHuf: number; discountHuf: number; totalHuf: number }
  sourcing: { items: OrderItem[]; subtotalHuf: number; discountHuf: number; totalHuf: number }
} {
  const inStockItems: OrderItem[] = []
  const sourcingItems: OrderItem[] = []
  let inStockSubtotal = 0
  let sourcingSubtotal = 0

  for (const { productId, qty } of items) {
    const product = productMap.get(productId)
    if (!product || qty < 1) continue
    const priceHuf = product.discountPriceHuf ?? product.priceHuf
    const lineTotal = priceHuf * qty
    const orderItem: OrderItem = {
      productId,
      qty,
      fulfillmentType: product.type === 'sourcing_deal' ? 'procurement' : 'stock',
      priceHuf,
      name: product.name,
    }
    if (product.type === 'sourcing_deal') {
      sourcingItems.push(orderItem)
      sourcingSubtotal += lineTotal
    } else {
      inStockItems.push(orderItem)
      inStockSubtotal += lineTotal
    }
  }

  const inStockDiscount = Math.round(inStockSubtotal * discountPercent)
  const sourcingDiscount = Math.round(sourcingSubtotal * discountPercent)
  return {
    inStock: {
      items: inStockItems,
      subtotalHuf: inStockSubtotal,
      discountHuf: inStockDiscount,
      totalHuf: inStockSubtotal - inStockDiscount,
    },
    sourcing: {
      items: sourcingItems,
      subtotalHuf: sourcingSubtotal,
      discountHuf: sourcingDiscount,
      totalHuf: sourcingSubtotal - sourcingDiscount,
    },
  }
}

export async function POST(request: Request) {
  const idemKey = getIdempotencyKey(request)
  if (idemKey) {
    const cached = await getIdempotentResponse(idemKey)
    if (cached) {
      return NextResponse.json(cached.body, {
        status: cached.status,
        headers: cached.headers,
      })
    }
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

  const { items, customer, isDiscountActive, discountPercent: bodyPercent } = parsed.data

  const productIds = Array.from(new Set(items.map((i) => i.productId)))
  const products = await getProductsByIdsAsync(productIds)
  const productMap = new Map<string, Product>(products.map((p) => [p.id, p]))

  let effectiveDiscountPercent = 0
  if (isDiscountActive && bodyPercent != null && bodyPercent > 0) {
    effectiveDiscountPercent = bodyPercent
  } else {
    const loyalty = getLoyaltyByEmail(customer.email)
    if (loyalty && loyalty.loyaltyPercent > 0) {
      effectiveDiscountPercent = loyalty.loyaltyPercent / 100
    }
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
    }
  }

  const { inStock, sourcing } = splitCartAndComputeTotals(items, effectiveDiscountPercent, productMap)

  const hasInStock = inStock.items.length > 0 && inStock.totalHuf > 0
  const hasSourcing = sourcing.items.length > 0 && sourcing.totalHuf > 0

  if (!hasInStock && !hasSourcing) {
    return NextResponse.json(
      { error: 'No valid items or invalid total' },
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
  const currency = 'huf'

  let createdOrders
  try {
    createdOrders = await createCheckoutOrders({
      orderGroupId,
      inStock: hasInStock ? inStock : undefined,
      sourcing: hasSourcing ? sourcing : undefined,
      currency,
    })
  } catch (err) {
    if (reservationIds.length > 0) {
      // Best-effort: ha a rendelés létrehozás elbukik, felszabadítjuk a sourcing slotokat.
      // (Nincs orderId még – a reservationök orderId nélkül maradnak, expire cron / manuális cancel.)
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
    throw err
  }

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

  const payload = { orderGroupId, payments: paymentResults }
  if (idemKey) {
    await setIdempotentResponse(idemKey, payload, 200)
  }
  return NextResponse.json(payload)
}
