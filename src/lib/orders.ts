/**
 * Rendelés tárolás. PROD (DATABASE_URL): Prisma + Postgres. DEV (nincs URL): JSON fallback (data/orders.json).
 */

import { logger } from '@/lib/logger'
import { prisma, isDbConfigured } from '@/lib/prisma'

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'created'
  | 'payment_pending'
  | 'cancelled'
  | 'sourcing_pending'
  | 'sourcing_failed'
  | 'fulfilled'

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
  refundedAmount?: number
  refundStatus?: RefundStatus
  cancelRequestedAt?: string
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
  items: { productId: string; qty: number; fulfillmentType: string; priceHuf: number; name: string | null }[]
}): Order {
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

export async function setOrderPaid(params: {
  orderId: string
  stripeSessionId: string
  paymentIntentId?: string
  amountPaid: number
  currencyPaid: string
  webhookEventId?: string
  customerEmail?: string
}): Promise<Order | null> {
  if (isDbConfigured()) {
    const existing = await prisma.order.findUnique({ where: { id: params.orderId }, include: { items: true } })
    if (!existing) return null
    if (existing.status === 'paid') return dbOrderToOrder(existing)
    if (existing.paidWebhookEventId === params.webhookEventId) return dbOrderToOrder(existing)
    await prisma.order.update({
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
    return getOrderById(params.orderId)
  }
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === params.orderId)
  if (idx < 0) return null
  const order = orders[idx]
  if (order.status === 'paid') return order
  if (order.paidWebhookEventId && order.paidWebhookEventId === params.webhookEventId) return order
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
  return order
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
  inStock?: { items: OrderItem[]; subtotalHuf: number; discountHuf: number; totalHuf: number }
  sourcing?: { items: OrderItem[]; subtotalHuf: number; discountHuf: number; totalHuf: number }
  currency?: string
}): Promise<Order[]> {
  const currency = params.currency ?? 'huf'
  const result: Order[] = []

  if (isDbConfigured()) {
    if (params.inStock && params.inStock.items.length > 0) {
      const id = generateOrderId()
      await prisma.order.create({
        data: {
          id,
          status: 'payment_pending',
          orderGroupId: params.orderGroupId,
          orderType: 'in_stock',
          subtotalHuf: params.inStock.subtotalHuf,
          discountHuf: params.inStock.discountHuf,
          totalHuf: params.inStock.totalHuf,
          currency,
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
        currency,
        createdAt: new Date().toISOString(),
      })
    }
    if (params.sourcing && params.sourcing.items.length > 0) {
      const id = generateOrderId()
      await prisma.order.create({
        data: {
          id,
          status: 'payment_pending',
          orderGroupId: params.orderGroupId,
          orderType: 'sourcing',
          subtotalHuf: params.sourcing.subtotalHuf,
          discountHuf: params.sourcing.discountHuf,
          totalHuf: params.sourcing.totalHuf,
          currency,
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
        currency,
        createdAt: new Date().toISOString(),
      })
    }
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
      currency,
      createdAt: new Date().toISOString(),
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
      currency,
      createdAt: new Date().toISOString(),
    }
    orders.push(o)
    result.push(o)
  }
  memoryStore = orders
  saveOrders()
  return result
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
