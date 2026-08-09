/**
 * Rendelés tárolás. PROD (DATABASE_URL): Prisma + Postgres. DEV (nincs URL): JSON fallback (data/orders.json).
 */

import { logger } from '@/lib/logger'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { decrementStockAtomic, OutOfStockException } from '@/lib/inventory'
import type { OrderCustomerSnapshot } from '@/lib/checkout-customer'

export { OutOfStockException }

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'created'
  | 'payment_pending'
  | 'cancelled'
  | 'expired'
  | 'needs_manual_review'
  | 'sourcing_pending'
  | 'sourcing_failed'
  | 'fulfilled'

/** Státuszok, ahol késői fizetési webhook NEM állíthat automatikusan paid-re. */
export const ORDER_TERMINAL_NON_PAYABLE = new Set<OrderStatus>([
  'cancelled',
  'failed',
  'expired',
  'sourcing_failed',
])

export type OrderType = 'in_stock' | 'sourcing'

export type FulfillmentType = 'stock' | 'procurement'

export type RefundStatus = 'none' | 'partial' | 'full'

export type OrderItem = {
  productId: string
  qty: number
  fulfillmentType: FulfillmentType
  priceHuf: number
  name?: string
}

export type Order = {
  id: string
  status: OrderStatus
  items: OrderItem[]
  subtotalHuf: number
  discountHuf: number
  totalHuf: number
  currency: string
  createdAt: string
  orderGroupId?: string
  orderType?: OrderType
  stripeSessionId?: string
  paymentIntentId?: string
  amountPaid?: number
  currencyPaid?: string
  paidAt?: string
  paidWebhookEventId?: string
  countedForLoyalty?: boolean
  customerEmail?: string
  customerName?: string
  customerPhone?: string
  shippingPostalCode?: string
  shippingCity?: string
  shippingStreet?: string
  shippingHouseNumber?: string
  billingSameAsShipping?: boolean
  billingPostalCode?: string
  billingCity?: string
  billingStreet?: string
  billingHouseNumber?: string
  refundedAmount?: number
  refundStatus?: RefundStatus
  cancelRequestedAt?: string
  userId?: string
  pointsDiscountHuf?: number
  pointsUsed?: number
  couponId?: string
  couponUsageRecorded?: boolean
  /** Manuálisan kiválasztott kuponok (cat, birthday, welcome, …). */
  appliedCoupons?: string[]
  rewardsFinalized?: boolean
}

const COUPON_PERCENT = 0.05
const ORDERS_FILE = 'data/orders.json'

let memoryStore: Order[] = []
let loaded = false

function getOrdersPath(): string {
  const path = require('path')
  return path.join(process.cwd(), ORDERS_FILE)
}

/** Dev: cache-el; JSON szerkesztés után node (dev server) restart kell a friss adathoz. */
function loadOrders(): Order[] {
  if (loaded) return memoryStore
  try {
    const fs = require('fs')
    const p = getOrdersPath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8')
      const parsed = JSON.parse(raw)
      memoryStore = Array.isArray(parsed) ? parsed : []
    } else {
      memoryStore = []
    }
  } catch {
    memoryStore = []
  }
  loaded = true
  return memoryStore
}

function saveOrders(): void {
  try {
    const fs = require('fs')
    const path = require('path')
    const p = getOrdersPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(p, JSON.stringify(memoryStore, null, 2), 'utf-8')
  } catch {
    // Élesben használj DB-t
  }
}

function generateOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function dbOrderToOrder(row: {
  id: string
  status: string
  orderGroupId: string | null
  orderType: string | null
  subtotalHuf: number
  discountHuf: number
  totalHuf: number
  currency: string
  createdAt: Date
  customerEmail: string | null
  customerName?: string | null
  customerPhone?: string | null
  shippingPostalCode?: string | null
  shippingCity?: string | null
  shippingStreet?: string | null
  shippingHouseNumber?: string | null
  billingSameAsShipping?: boolean | null
  billingPostalCode?: string | null
  billingCity?: string | null
  billingStreet?: string | null
  billingHouseNumber?: string | null
  stripeSessionId: string | null
  paymentIntentId: string | null
  amountPaid: number | null
  currencyPaid: string | null
  paidAt: Date | null
  paidWebhookEventId: string | null
  countedForLoyalty: boolean
  refundedAmount: number | null
  refundStatus: string | null
  cancelRequestedAt: Date | null
  userId: string | null
  pointsDiscountHuf: number
  pointsUsed: number
  couponId: string | null
  couponUsageRecorded: boolean
  appliedCoupons?: unknown
  rewardsFinalized?: boolean
  items: { productId: string; qty: number; fulfillmentType: string; priceHuf: number; name: string | null }[]
}): Order {
  const appliedCoupons = Array.isArray(row.appliedCoupons)
    ? row.appliedCoupons.filter((x): x is string => typeof x === 'string')
    : undefined
  return {
    id: row.id,
    status: row.status as OrderStatus,
    orderGroupId: row.orderGroupId ?? undefined,
    orderType: (row.orderType as OrderType) ?? undefined,
    subtotalHuf: row.subtotalHuf,
    discountHuf: row.discountHuf,
    totalHuf: row.totalHuf,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    customerEmail: row.customerEmail ?? undefined,
    customerName: row.customerName ?? undefined,
    customerPhone: row.customerPhone ?? undefined,
    shippingPostalCode: row.shippingPostalCode ?? undefined,
    shippingCity: row.shippingCity ?? undefined,
    shippingStreet: row.shippingStreet ?? undefined,
    shippingHouseNumber: row.shippingHouseNumber ?? undefined,
    billingSameAsShipping: row.billingSameAsShipping ?? undefined,
    billingPostalCode: row.billingPostalCode ?? undefined,
    billingCity: row.billingCity ?? undefined,
    billingStreet: row.billingStreet ?? undefined,
    billingHouseNumber: row.billingHouseNumber ?? undefined,
    userId: row.userId ?? undefined,
    pointsDiscountHuf: row.pointsDiscountHuf,
    pointsUsed: row.pointsUsed,
    couponId: row.couponId ?? undefined,
    couponUsageRecorded: row.couponUsageRecorded,
    appliedCoupons,
    rewardsFinalized: row.rewardsFinalized,
    stripeSessionId: row.stripeSessionId ?? undefined,
    paymentIntentId: row.paymentIntentId ?? undefined,
    amountPaid: row.amountPaid ?? undefined,
    currencyPaid: row.currencyPaid ?? undefined,
    paidAt: row.paidAt?.toISOString(),
    paidWebhookEventId: row.paidWebhookEventId ?? undefined,
    countedForLoyalty: row.countedForLoyalty,
    refundedAmount: row.refundedAmount ?? undefined,
    refundStatus: (row.refundStatus as RefundStatus) ?? undefined,
    cancelRequestedAt: row.cancelRequestedAt?.toISOString(),
    items: row.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      fulfillmentType: i.fulfillmentType as FulfillmentType,
      priceHuf: i.priceHuf,
      name: i.name ?? undefined,
    })),
  }
}

function customerSnapshotFields(customer?: OrderCustomerSnapshot) {
  if (!customer) return {}
  return {
    customerEmail: customer.email,
    customerName: customer.name,
    customerPhone: customer.phone,
    shippingPostalCode: customer.shippingPostalCode,
    shippingCity: customer.shippingCity,
    shippingStreet: customer.shippingStreet,
    shippingHouseNumber: customer.shippingHouseNumber,
    billingSameAsShipping: customer.billingSameAsShipping,
    billingPostalCode: customer.billingPostalCode,
    billingCity: customer.billingCity,
    billingStreet: customer.billingStreet,
    billingHouseNumber: customer.billingHouseNumber,
  }
}

/** Új rendelés létrehozása (pending). */
export async function createOrder(params: {
  items: OrderItem[]
  subtotalHuf: number
  discountHuf: number
  totalHuf: number
  currency?: string
}): Promise<Order> {
  if (isDbConfigured()) {
    const id = generateOrderId()
    await prisma.order.create({
      data: {
        id,
        status: 'pending',
        subtotalHuf: params.subtotalHuf,
        discountHuf: params.discountHuf,
        totalHuf: params.totalHuf,
        currency: params.currency ?? 'huf',
        items: {
          create: params.items.map((i) => ({
            productId: i.productId,
            qty: i.qty,
            fulfillmentType: i.fulfillmentType,
            priceHuf: i.priceHuf,
            name: i.name ?? null,
          })),
        },
      },
      include: { items: true },
    })
    return {
      id,
      status: 'pending',
      items: params.items,
      subtotalHuf: params.subtotalHuf,
      discountHuf: params.discountHuf,
      totalHuf: params.totalHuf,
      currency: params.currency ?? 'huf',
      createdAt: new Date().toISOString(),
    }
  }
  const orders = loadOrders()
  const order: Order = {
    id: generateOrderId(),
    status: 'pending',
    items: params.items,
    subtotalHuf: params.subtotalHuf,
    discountHuf: params.discountHuf,
    totalHuf: params.totalHuf,
    currency: params.currency ?? 'huf',
    createdAt: new Date().toISOString(),
  }
  orders.push(order)
  memoryStore = orders
  saveOrders()
  return order
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  if (isDbConfigured()) {
    const row = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    return row ? dbOrderToOrder(row) : null
  }
  const orders = loadOrders()
  return orders.find((o) => o.id === orderId) ?? null
}

export async function getOrderByStripeSessionId(sessionId: string): Promise<Order | null> {
  if (isDbConfigured()) {
    const row = await prisma.order.findFirst({
      where: { stripeSessionId: sessionId },
      include: { items: true },
    })
    return row ? dbOrderToOrder(row) : null
  }
  const orders = loadOrders()
  return orders.find((o) => o.stripeSessionId === sessionId) ?? null
}

export type SetOrderPaidResult = {
  order: Order | null
  /** true: rendelés cancelled/failed/expired volt – NEEDS_MANUAL_REVIEW, nem paid */
  latePayment: boolean
}

export async function setOrderPaid(params: {
  orderId: string
  stripeSessionId: string
  paymentIntentId?: string
  amountPaid: number
  currencyPaid: string
  webhookEventId?: string
  customerEmail?: string
}): Promise<SetOrderPaidResult> {
  if (isDbConfigured()) {
    const existing = await prisma.order.findUnique({ where: { id: params.orderId }, include: { items: true } })
    if (!existing) return { order: null, latePayment: false }
    if (existing.status === 'paid') return { order: dbOrderToOrder(existing), latePayment: false }
    if (existing.status === 'needs_manual_review') {
      return { order: dbOrderToOrder(existing), latePayment: true }
    }
    if (existing.paidWebhookEventId === params.webhookEventId) {
      return { order: dbOrderToOrder(existing), latePayment: false }
    }

    const currentStatus = existing.status as OrderStatus
    if (ORDER_TERMINAL_NON_PAYABLE.has(currentStatus)) {
      logger.warn(
        {
          event: 'LATE_PAYMENT_WARNING',
          orderId: params.orderId,
          previousStatus: currentStatus,
          stripeSessionId: params.stripeSessionId,
          paymentIntentId: params.paymentIntentId,
          amountPaid: params.amountPaid,
          webhookEventId: params.webhookEventId,
        },
        'LATE_PAYMENT_WARNING: payment arrived after order terminal status – needs_manual_review'
      )
      await prisma.order.update({
        where: { id: params.orderId },
        data: {
          status: 'needs_manual_review',
          stripeSessionId: params.stripeSessionId,
          paymentIntentId: params.paymentIntentId ?? existing.paymentIntentId,
          amountPaid: params.amountPaid,
          currencyPaid: params.currencyPaid,
          paidWebhookEventId: params.webhookEventId ?? existing.paidWebhookEventId,
          customerEmail: params.customerEmail ?? existing.customerEmail,
          // paidAt szándékosan NEM – nincs automatikus teljesítés
        },
      })
      return { order: await getOrderById(params.orderId), latePayment: true }
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: params.orderId },
        data: {
          status: 'paid',
          stripeSessionId: params.stripeSessionId,
          paymentIntentId: params.paymentIntentId ?? null,
          amountPaid: params.amountPaid,
          currencyPaid: params.currencyPaid,
          paidAt: new Date(),
          paidWebhookEventId: params.webhookEventId ?? null,
          customerEmail: params.customerEmail ?? existing.customerEmail,
          refundStatus: existing.refundStatus ?? 'none',
          refundedAmount: existing.refundedAmount ?? 0,
        },
      })

      // Készlet már a checkout createCheckoutOrders atomi UPDATE-jében levonva (oversell védelem).
      // Itt NEM csökkentünk újra – elkerüljük a dupla levonást.
    })
    return { order: await getOrderById(params.orderId), latePayment: false }
  }
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === params.orderId)
  if (idx < 0) return { order: null, latePayment: false }
  const order = orders[idx]
  if (order.status === 'paid') return { order, latePayment: false }
  if (order.status === 'needs_manual_review') return { order, latePayment: true }
  if (order.paidWebhookEventId && order.paidWebhookEventId === params.webhookEventId) {
    return { order, latePayment: false }
  }
  if (ORDER_TERMINAL_NON_PAYABLE.has(order.status)) {
    logger.warn(
      {
        event: 'LATE_PAYMENT_WARNING',
        orderId: params.orderId,
        previousStatus: order.status,
        stripeSessionId: params.stripeSessionId,
        webhookEventId: params.webhookEventId,
      },
      'LATE_PAYMENT_WARNING: payment arrived after order terminal status – needs_manual_review'
    )
    order.status = 'needs_manual_review'
    order.stripeSessionId = params.stripeSessionId
    order.paymentIntentId = params.paymentIntentId
    order.amountPaid = params.amountPaid
    order.currencyPaid = params.currencyPaid
    order.paidWebhookEventId = params.webhookEventId
    order.customerEmail = params.customerEmail ?? order.customerEmail
    memoryStore = orders
    saveOrders()
    return { order, latePayment: true }
  }
  order.status = 'paid'
  order.stripeSessionId = params.stripeSessionId
  order.paymentIntentId = params.paymentIntentId
  order.amountPaid = params.amountPaid
  order.currencyPaid = params.currencyPaid
  order.paidAt = new Date().toISOString()
  order.paidWebhookEventId = params.webhookEventId
  order.customerEmail = params.customerEmail ?? order.customerEmail
  order.refundStatus = order.refundStatus ?? 'none'
  order.refundedAmount = order.refundedAmount ?? 0
  memoryStore = orders
  saveOrders()
  return { order, latePayment: false }
}

export async function setOrderFailed(orderId: string): Promise<Order | null> {
  if (isDbConfigured()) {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'failed' } })
    return getOrderById(orderId)
  }
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx < 0) return null
  orders[idx].status = 'failed'
  memoryStore = orders
  saveOrders()
  return orders[idx]
}

export async function setOrderCountedForLoyalty(orderId: string, value = true): Promise<Order | null> {
  if (isDbConfigured()) {
    await prisma.order.update({ where: { id: orderId }, data: { countedForLoyalty: value } })
    return getOrderById(orderId)
  }
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx < 0) return null
  orders[idx].countedForLoyalty = value
  memoryStore = orders
  saveOrders()
  return orders[idx]
}

export async function getOrderByPaymentIntentId(paymentIntentId: string): Promise<Order | null> {
  if (isDbConfigured()) {
    const row = await prisma.order.findFirst({
      where: { paymentIntentId },
      include: { items: true },
    })
    return row ? dbOrderToOrder(row) : null
  }
  const orders = loadOrders()
  return orders.find((o) => o.paymentIntentId === paymentIntentId) ?? null
}

export function generateOrderGroupId(): string {
  return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function createCheckoutOrders(params: {
  orderGroupId: string
  userId?: string
  couponId?: string
  /** Manuálisan kiválasztott kuponok a fizetésnél. */
  appliedCoupons?: string[]
  /** Szállítási / számlázási / kapcsolattartó adatok. */
  customer?: OrderCustomerSnapshot
  inStock?: {
    items: OrderItem[]
    subtotalHuf: number
    discountHuf: number
    totalHuf: number
    pointsDiscountHuf?: number
    pointsUsed?: number
  }
  sourcing?: {
    items: OrderItem[]
    subtotalHuf: number
    discountHuf: number
    totalHuf: number
    pointsDiscountHuf?: number
    pointsUsed?: number
  }
  currency?: string
}): Promise<Order[]> {
  const currency = params.currency ?? 'huf'
  const result: Order[] = []
  const appliedCoupons = Array.isArray(params.appliedCoupons) ? params.appliedCoupons : []
  const customerFields = customerSnapshotFields(params.customer)

  if (isDbConfigured()) {
    // Atomi tranzakció: in_stock stock decrement + rendelés létrehozás (oversell védelem).
    await prisma.$transaction(async (tx) => {
      if (params.inStock && params.inStock.items.length > 0) {
        await decrementStockAtomic(
          params.inStock.items.map((i) => ({ productId: i.productId, qty: i.qty })),
          tx
        )
        const id = generateOrderId()
        await tx.order.create({
          data: {
            id,
            status: 'payment_pending',
            orderGroupId: params.orderGroupId,
            orderType: 'in_stock',
            subtotalHuf: params.inStock.subtotalHuf,
            discountHuf: params.inStock.discountHuf,
            totalHuf: params.inStock.totalHuf,
            pointsDiscountHuf: params.inStock.pointsDiscountHuf ?? 0,
            pointsUsed: params.inStock.pointsUsed ?? 0,
            userId: params.userId ?? null,
            couponId: params.couponId ?? null,
            appliedCoupons,
            currency,
            ...customerFields,
            items: {
              create: params.inStock.items.map((i) => ({
                productId: i.productId,
                qty: i.qty,
                fulfillmentType: i.fulfillmentType,
                priceHuf: i.priceHuf,
                name: i.name ?? null,
              })),
            },
          },
        })
        result.push({
          id,
          status: 'payment_pending',
          orderGroupId: params.orderGroupId,
          orderType: 'in_stock',
          items: params.inStock.items,
          subtotalHuf: params.inStock.subtotalHuf,
          discountHuf: params.inStock.discountHuf,
          totalHuf: params.inStock.totalHuf,
          pointsDiscountHuf: params.inStock.pointsDiscountHuf ?? 0,
          pointsUsed: params.inStock.pointsUsed ?? 0,
          userId: params.userId,
          couponId: params.couponId,
          appliedCoupons,
          currency,
          createdAt: new Date().toISOString(),
          customerEmail: params.customer?.email,
          customerName: params.customer?.name,
          customerPhone: params.customer?.phone,
          shippingPostalCode: params.customer?.shippingPostalCode,
          shippingCity: params.customer?.shippingCity,
          shippingStreet: params.customer?.shippingStreet,
          shippingHouseNumber: params.customer?.shippingHouseNumber,
          billingSameAsShipping: params.customer?.billingSameAsShipping,
          billingPostalCode: params.customer?.billingPostalCode ?? undefined,
          billingCity: params.customer?.billingCity ?? undefined,
          billingStreet: params.customer?.billingStreet ?? undefined,
          billingHouseNumber: params.customer?.billingHouseNumber ?? undefined,
        })
      }
      if (params.sourcing && params.sourcing.items.length > 0) {
        const id = generateOrderId()
        await tx.order.create({
          data: {
            id,
            status: 'payment_pending',
            orderGroupId: params.orderGroupId,
            orderType: 'sourcing',
            subtotalHuf: params.sourcing.subtotalHuf,
            discountHuf: params.sourcing.discountHuf,
            totalHuf: params.sourcing.totalHuf,
            pointsDiscountHuf: params.sourcing.pointsDiscountHuf ?? 0,
            pointsUsed: params.sourcing.pointsUsed ?? 0,
            userId: params.userId ?? null,
            couponId: params.couponId ?? null,
            appliedCoupons,
            currency,
            ...customerFields,
            items: {
              create: params.sourcing.items.map((i) => ({
                productId: i.productId,
                qty: i.qty,
                fulfillmentType: i.fulfillmentType,
                priceHuf: i.priceHuf,
                name: i.name ?? null,
              })),
            },
          },
        })
        result.push({
          id,
          status: 'payment_pending',
          orderGroupId: params.orderGroupId,
          orderType: 'sourcing',
          items: params.sourcing.items,
          subtotalHuf: params.sourcing.subtotalHuf,
          discountHuf: params.sourcing.discountHuf,
          totalHuf: params.sourcing.totalHuf,
          pointsDiscountHuf: params.sourcing.pointsDiscountHuf ?? 0,
          pointsUsed: params.sourcing.pointsUsed ?? 0,
          userId: params.userId,
          couponId: params.couponId,
          appliedCoupons,
          currency,
          createdAt: new Date().toISOString(),
          customerEmail: params.customer?.email,
          customerName: params.customer?.name,
          customerPhone: params.customer?.phone,
          shippingPostalCode: params.customer?.shippingPostalCode,
          shippingCity: params.customer?.shippingCity,
          shippingStreet: params.customer?.shippingStreet,
          shippingHouseNumber: params.customer?.shippingHouseNumber,
          billingSameAsShipping: params.customer?.billingSameAsShipping,
          billingPostalCode: params.customer?.billingPostalCode ?? undefined,
          billingCity: params.customer?.billingCity ?? undefined,
          billingStreet: params.customer?.billingStreet ?? undefined,
          billingHouseNumber: params.customer?.billingHouseNumber ?? undefined,
        })
      }
    })
    return result
  }

  const orders = loadOrders()
  if (params.inStock && params.inStock.items.length > 0) {
    const o: Order = {
      id: generateOrderId(),
      status: 'payment_pending',
      orderGroupId: params.orderGroupId,
      orderType: 'in_stock',
      items: params.inStock.items,
      subtotalHuf: params.inStock.subtotalHuf,
      discountHuf: params.inStock.discountHuf,
      totalHuf: params.inStock.totalHuf,
      couponId: params.couponId,
      currency,
      createdAt: new Date().toISOString(),
      customerEmail: params.customer?.email,
      customerName: params.customer?.name,
      customerPhone: params.customer?.phone,
      shippingPostalCode: params.customer?.shippingPostalCode,
      shippingCity: params.customer?.shippingCity,
      shippingStreet: params.customer?.shippingStreet,
      shippingHouseNumber: params.customer?.shippingHouseNumber,
      billingSameAsShipping: params.customer?.billingSameAsShipping,
      billingPostalCode: params.customer?.billingPostalCode ?? undefined,
      billingCity: params.customer?.billingCity ?? undefined,
      billingStreet: params.customer?.billingStreet ?? undefined,
      billingHouseNumber: params.customer?.billingHouseNumber ?? undefined,
    }
    orders.push(o)
    result.push(o)
  }
  if (params.sourcing && params.sourcing.items.length > 0) {
    const o: Order = {
      id: generateOrderId(),
      status: 'payment_pending',
      orderGroupId: params.orderGroupId,
      orderType: 'sourcing',
      items: params.sourcing.items,
      subtotalHuf: params.sourcing.subtotalHuf,
      discountHuf: params.sourcing.discountHuf,
      totalHuf: params.sourcing.totalHuf,
      couponId: params.couponId,
      currency,
      createdAt: new Date().toISOString(),
      customerEmail: params.customer?.email,
      customerName: params.customer?.name,
      customerPhone: params.customer?.phone,
      shippingPostalCode: params.customer?.shippingPostalCode,
      shippingCity: params.customer?.shippingCity,
      shippingStreet: params.customer?.shippingStreet,
      shippingHouseNumber: params.customer?.shippingHouseNumber,
      billingSameAsShipping: params.customer?.billingSameAsShipping,
      billingPostalCode: params.customer?.billingPostalCode ?? undefined,
      billingCity: params.customer?.billingCity ?? undefined,
      billingStreet: params.customer?.billingStreet ?? undefined,
      billingHouseNumber: params.customer?.billingHouseNumber ?? undefined,
    }
    orders.push(o)
    result.push(o)
  }
  memoryStore = orders
  saveOrders()
  return result
}

/** Bejelentkezett felhasználó rendelései (legújabb elöl). */
export async function getOrdersByUserId(
  userId: string,
  options?: { limit?: number }
): Promise<Order[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100)
  if (isDbConfigured()) {
    const rows = await prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(dbOrderToOrder)
  }
  const orders = loadOrders()
  return orders
    .filter((o) => o.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
}

export async function getOrdersByGroupId(orderGroupId: string): Promise<Order[]> {
  if (isDbConfigured()) {
    const rows = await prisma.order.findMany({
      where: { orderGroupId },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(dbOrderToOrder)
  }
  const orders = loadOrders()
  return orders.filter((o) => o.orderGroupId === orderGroupId)
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
  if (isDbConfigured()) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(status === 'paid' ? { paidAt: new Date() } : {}),
      },
    })
    return getOrderById(orderId)
  }
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx < 0) return null
  orders[idx].status = status
  if (status === 'paid') orders[idx].paidAt = new Date().toISOString()
  memoryStore = orders
  saveOrders()
  return orders[idx]
}

export async function setOrderCustomerEmail(orderId: string, email: string): Promise<Order | null> {
  if (isDbConfigured()) {
    await prisma.order.update({ where: { id: orderId }, data: { customerEmail: email } })
    return getOrderById(orderId)
  }
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx < 0) return null
  orders[idx].customerEmail = email
  memoryStore = orders
  saveOrders()
  return orders[idx]
}

const SOURCING_COUNT_STATUSES = ['payment_pending', 'sourcing_pending', 'fulfilled', 'paid'] as const

/** JSON alapú ordersCount egy termékre (loadOrders + aggregáció). Server componentben a fájl elérhető (Node fs). */
function getProductOrdersCountFromJson(productId: string): number {
  const orders = loadOrders()
  const statuses = new Set<string>(SOURCING_COUNT_STATUSES)
  let sum = 0
  for (const order of orders) {
    if (!statuses.has(order.status)) continue
    for (const item of order.items) {
      if (item.productId === productId) sum += item.qty
    }
  }
  return sum
}

/** Több termék ordersCount-ja JSON-ból egy ciklusban. */
function getProductOrdersCountsFromJson(productIds: string[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const id of productIds) result[id] = 0
  const orders = loadOrders()
  const statuses = new Set<string>(SOURCING_COUNT_STATUSES)
  for (const order of orders) {
    if (!statuses.has(order.status)) continue
    for (const item of order.items) {
      if (result[item.productId] !== undefined) result[item.productId] += item.qty
    }
  }
  return result
}

const ORDERS_COUNT_RETRY_ATTEMPTS = 4
const ORDERS_COUNT_RETRY_DELAY_MS = 400
const ORDERS_COUNT_LAST_RETRY_DELAY_MS = 2000

/** DB lekérdezés újrapróbálása deploy / átmeneti kapcsolat után, ne nullázzon a számolás. */
async function withRetry<T>(fn: () => Promise<T>, attempt = 1): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const isLast = attempt >= ORDERS_COUNT_RETRY_ATTEMPTS
    const isProduction = process.env.NODE_ENV === 'production'
    const delay = isLast && isProduction ? ORDERS_COUNT_LAST_RETRY_DELAY_MS : ORDERS_COUNT_RETRY_DELAY_MS * attempt
    if (isLast) throw err
    await new Promise((r) => setTimeout(r, delay))
    return withRetry(fn, attempt + 1)
  }
}

/**
 * Sourcing deal: egy termékre a rendelt mennyiség (DB vagy JSON).
 * DB esetén újrapróbálkozás deploy/refresh után, hogy ne nullázzon a számolás. Ne dobjon.
 */
export async function getProductOrdersCount(productId: string): Promise<number> {
  if (!isDbConfigured()) return getProductOrdersCountFromJson(productId)
  try {
    return await withRetry(async () => {
      const agg = await prisma.orderItem.aggregate({
        where: {
          productId,
          order: { status: { in: [...SOURCING_COUNT_STATUSES] } },
        },
        _sum: { qty: true },
      })
      return agg._sum.qty ?? 0
    })
  } catch (err) {
    logger.warn({ err, productId }, 'DB unreachable for orders count after retries, falling back to JSON')
    const jsonCount = getProductOrdersCountFromJson(productId)
    if (process.env.NODE_ENV === 'production' && jsonCount === 0) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const agg = await prisma.orderItem.aggregate({
          where: {
            productId,
            order: { status: { in: [...SOURCING_COUNT_STATUSES] } },
          },
          _sum: { qty: true },
        })
        return agg._sum.qty ?? 0
      } catch {
        // marad 0, de legalább nem dob
      }
    }
    return jsonCount
  }
}

/**
 * Több termék ordersCount-ja egy batch queryvel (groupBy).
 * DB esetén újrapróbálkozás deploy/refresh után; élesben üres JSON fallbackot kerüljük, ne nullázzon.
 */
export async function getProductOrdersCounts(productIds: string[]): Promise<Record<string, number>> {
  const empty = productIds.length === 0
  const result: Record<string, number> = {}
  for (const id of productIds) result[id] = 0
  if (empty) return result
  if (!isDbConfigured()) return getProductOrdersCountsFromJson(productIds)
  try {
    const rows = await withRetry(async () =>
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { qty: true },
        where: {
          productId: { in: productIds },
          order: { status: { in: [...SOURCING_COUNT_STATUSES] } },
        },
      })
    )
    for (const row of rows) {
      if (result[row.productId] !== undefined) result[row.productId] = row._sum.qty ?? 0
    }
    return result
  } catch (err) {
    logger.warn({ err, productIds }, 'DB unreachable for orders counts batch after retries, falling back to JSON')
    const jsonResult = getProductOrdersCountsFromJson(productIds)
    const jsonIsEmpty = Object.values(jsonResult).every((c) => c === 0)
    if (process.env.NODE_ENV === 'production' && jsonIsEmpty) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const rows = await prisma.orderItem.groupBy({
          by: ['productId'],
          _sum: { qty: true },
          where: {
            productId: { in: productIds },
            order: { status: { in: [...SOURCING_COUNT_STATUSES] } },
          },
        })
        for (const row of rows) {
          if (result[row.productId] !== undefined) result[row.productId] = row._sum.qty ?? 0
        }
        return result
      } catch {
        // marad 0, ne dobjon
      }
    }
    return jsonResult
  }
}

export { COUPON_PERCENT }
