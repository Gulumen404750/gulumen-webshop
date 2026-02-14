/**
 * Fizetési tranzakciók tárolása (provider-független).
 * data/payment-transactions.json
 */

export type PaymentTransactionMode = 'capture' | 'authorize'

export type PaymentTransactionStatus =
  | 'created'
  | 'pending'
  | 'succeeded'
  | 'cancelled'
  | 'failed'

export type PaymentTransaction = {
  id: string
  orderId: string
  provider: string
  mode: PaymentTransactionMode
  status: PaymentTransactionStatus
  amount: number
  currency: string
  providerRef?: string
  createdAt: string // ISO
}

const FILE = 'data/payment-transactions.json'
let memoryStore: PaymentTransaction[] = []
let loaded = false

function getPath(): string {
  const path = require('path')
  return path.join(process.cwd(), FILE)
}

function load(): PaymentTransaction[] {
  if (loaded) return memoryStore
  try {
    const fs = require('fs')
    const p = getPath()
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

function save(): void {
  try {
    const fs = require('fs')
    const path = require('path')
    const p = getPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(p, JSON.stringify(memoryStore, null, 2), 'utf-8')
  } catch (e) {
    console.error('[payment-transactions] save failed', e)
  }
}

function generateId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createPaymentTransaction(params: {
  orderId: string
  provider: string
  mode: PaymentTransactionMode
  amount: number
  currency: string
}): PaymentTransaction {
  const list = load()
  const tx: PaymentTransaction = {
    id: generateId(),
    orderId: params.orderId,
    provider: params.provider,
    mode: params.mode,
    status: 'created',
    amount: params.amount,
    currency: params.currency,
    createdAt: new Date().toISOString(),
  }
  list.push(tx)
  memoryStore = list
  save()
  console.debug('[payment-transactions] created', { id: tx.id, orderId: params.orderId, mode: params.mode })
  return tx
}

export function getPaymentTransactionById(id: string): PaymentTransaction | null {
  const list = load()
  return list.find((t) => t.id === id) ?? null
}

export function getPaymentTransactionsByOrderId(orderId: string): PaymentTransaction[] {
  const list = load()
  return list.filter((t) => t.orderId === orderId)
}

export function updatePaymentTransactionStatus(
  id: string,
  status: PaymentTransactionStatus,
  providerRef?: string
): PaymentTransaction | null {
  const list = load()
  const idx = list.findIndex((t) => t.id === id)
  if (idx < 0) return null
  list[idx].status = status
  if (providerRef !== undefined) list[idx].providerRef = providerRef
  memoryStore = list
  save()
  console.debug('[payment-transactions] status updated', { id, status })
  return list[idx]
}
