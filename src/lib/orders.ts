/**
 * Rendelés tárolás. Fejlesztéshez fájl alapú (data/orders.json).
 *
 * ÉLESBEN TILOS fájl tárolás: használj Prisma + Postgres (Supabase, Neon, Railway).
 * Táblák: order (id, status, totalHuf, stripeSessionId, paidAt, refundedAmount, refundStatus, cancelRequestedAt, …),
 * order_items (orderId, productId, qty, fulfillmentType, priceHuf, name),
 * payments (orderId, stripeSessionId, paymentIntentId, amountPaid, currencyPaid, paidWebhookEventId).
 */

export type OrderStatus = 'pending' | 'paid' | 'failed'

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
  createdAt: string // ISO
  // Stripe – webhook után
  stripeSessionId?: string
  paymentIntentId?: string
  amountPaid?: number
  currencyPaid?: string
  paidAt?: string // ISO
  paidWebhookEventId?: string // idempotencia: már feldolgozott event
  /** Hűség: ez a rendelés már beleszámított a minősített vásárlásszámba (idempotencia). */
  countedForLoyalty?: boolean
  /** Hűség / refund: e-mail, amivel a vásárló fizetett (webhookból). */
  customerEmail?: string
  // Visszatérítés / lemondás (későbbi UI-hoz)
  refundedAmount?: number
  refundStatus?: RefundStatus
  cancelRequestedAt?: string // ISO
}

const COUPON_PERCENT = 0.05
const ORDERS_FILE = 'data/orders.json'

let memoryStore: Order[] = []
let loaded = false

function getOrdersPath(): string {
  const path = require('path')
  return path.join(process.cwd(), ORDERS_FILE)
}

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
    // Élesben használj DB-t; fájl írás pl. Vercel-en nem megbízható
  }
}

function generateOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Új rendelés létrehozása (pending). */
export function createOrder(params: {
  items: OrderItem[]
  subtotalHuf: number
  discountHuf: number
  totalHuf: number
  currency?: string
}): Order {
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

export function getOrderById(orderId: string): Order | null {
  const orders = loadOrders()
  return orders.find((o) => o.id === orderId) ?? null
}

export function getOrderByStripeSessionId(sessionId: string): Order | null {
  const orders = loadOrders()
  return orders.find((o) => o.stripeSessionId === sessionId) ?? null
}

/** Webhook: checkout.session.completed – paid státusz és Stripe adatok mentése. Idempotens: ha már paid, nem írja felül. */
export function setOrderPaid(params: {
  orderId: string
  stripeSessionId: string
  paymentIntentId?: string
  amountPaid: number
  currencyPaid: string
  webhookEventId?: string
  customerEmail?: string
}): Order | null {
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === params.orderId)
  if (idx < 0) return null
  const order = orders[idx]
  if (order.status === 'paid') {
    return order
  }
  if (order.paidWebhookEventId && order.paidWebhookEventId === params.webhookEventId) {
    return order
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
  return order
}

/** payment_intent.payment_failed – opcionális. */
export function setOrderFailed(orderId: string): Order | null {
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx < 0) return null
  orders[idx].status = 'failed'
  memoryStore = orders
  saveOrders()
  return orders[idx]
}

/** Hűség idempotencia: megjelöljük, hogy ez a rendelés már beleszámított (vagy refund esetén false). */
export function setOrderCountedForLoyalty(orderId: string, value = true): Order | null {
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx < 0) return null
  orders[idx].countedForLoyalty = value
  memoryStore = orders
  saveOrders()
  return orders[idx]
}

export function getOrderByPaymentIntentId(paymentIntentId: string): Order | null {
  const orders = loadOrders()
  return orders.find((o) => o.paymentIntentId === paymentIntentId) ?? null
}

export { COUPON_PERCENT }
