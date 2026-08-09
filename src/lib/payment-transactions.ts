/**
 * Fizetési tranzakciók tárolása (provider-független).
 * PROD (DATABASE_URL): Prisma + Postgres – multi-instance biztonságos.
 * DEV (nincs URL): JSON fallback (data/payment-transactions.json).
 *
 * Webhook státuszváltás: claimPaymentTransactionStatus() – atomi CAS (updateMany),
 * így több szerverpéldány mellett sem fut duplán a succeeded / failed feldolgozás.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'

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

const TERMINAL_STATUSES: PaymentTransactionStatus[] = ['succeeded', 'failed', 'cancelled']

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

function rowToTx(row: {
  id: string
  orderId: string
  provider: string
  mode: string
  status: string
  amount: number
  currency: string
  providerRef: string | null
  createdAt: Date
}): PaymentTransaction {
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    mode: row.mode as PaymentTransactionMode,
    status: row.status as PaymentTransactionStatus,
    amount: row.amount,
    currency: row.currency,
    providerRef: row.providerRef ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createPaymentTransaction(params: {
  orderId: string
  provider: string
  mode: PaymentTransactionMode
  amount: number
  currency: string
  status?: PaymentTransactionStatus
}): Promise<PaymentTransaction> {
  const id = generateId()
  const status = params.status ?? 'created'
  const createdAt = new Date()

  if (isDbConfigured()) {
    const row = await prisma.paymentTransaction.create({
      data: {
        id,
        orderId: params.orderId,
        provider: params.provider,
        mode: params.mode,
        status,
        amount: params.amount,
        currency: params.currency,
      },
    })
    console.debug('[payment-transactions] created', { id: row.id, orderId: params.orderId, mode: params.mode })
    return rowToTx(row)
  }

  const tx: PaymentTransaction = {
    id,
    orderId: params.orderId,
    provider: params.provider,
    mode: params.mode,
    status,
    amount: params.amount,
    currency: params.currency,
    createdAt: createdAt.toISOString(),
  }
  const list = load()
  list.push(tx)
  memoryStore = list
  save()
  console.debug('[payment-transactions] created', { id: tx.id, orderId: params.orderId, mode: params.mode })
  return tx
}

export async function getPaymentTransactionById(id: string): Promise<PaymentTransaction | null> {
  if (isDbConfigured()) {
    const row = await prisma.paymentTransaction.findUnique({ where: { id } })
    return row ? rowToTx(row) : null
  }
  const list = load()
  return list.find((t) => t.id === id) ?? null
}

export async function getPaymentTransactionsByOrderId(orderId: string): Promise<PaymentTransaction[]> {
  if (isDbConfigured()) {
    const rows = await prisma.paymentTransaction.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(rowToTx)
  }
  const list = load()
  return list.filter((t) => t.orderId === orderId)
}

/**
 * Nem-atomikus státuszfrissítés (admin / checkout pending jelölés).
 * Webhookhoz preferáld a claimPaymentTransactionStatus-t.
 */
export async function updatePaymentTransactionStatus(
  id: string,
  status: PaymentTransactionStatus,
  providerRef?: string
): Promise<PaymentTransaction | null> {
  if (isDbConfigured()) {
    try {
      const row = await prisma.paymentTransaction.update({
        where: { id },
        data: {
          status,
          ...(providerRef !== undefined ? { providerRef } : {}),
        },
      })
      console.debug('[payment-transactions] status updated', { id, status })
      return rowToTx(row)
    } catch {
      return null
    }
  }
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

export type ClaimPaymentTransactionResult = {
  /** true: ez a példány nyerte a státuszváltást, folytathatja a side-effecteket */
  claimed: boolean
  /** false claimed esetén is visszaadjuk a jelenlegi sort (ha létezik) */
  tx: PaymentTransaction | null
  /** true: a tranzakció már a célstátuszban volt (idempotens újrapróba) */
  alreadyInStatus: boolean
}

/**
 * Atomi státusz-claim webhookokhoz (multi-instance biztonságos).
 * - succeeded: csak ha még nem succeeded
 * - failed/cancelled: csak ha még nem terminális (succeeded/failed/cancelled)
 * - pending: csak created → pending
 */
export async function claimPaymentTransactionStatus(
  id: string,
  status: PaymentTransactionStatus,
  providerRef?: string
): Promise<ClaimPaymentTransactionResult> {
  if (isDbConfigured()) {
    const existing = await prisma.paymentTransaction.findUnique({ where: { id } })
    if (!existing) {
      return { claimed: false, tx: null, alreadyInStatus: false }
    }
    if (existing.status === status) {
      // Idempotens újrapróba: providerRef frissíthető, side-effect NEM
      if (providerRef !== undefined && existing.providerRef !== providerRef) {
        const row = await prisma.paymentTransaction.update({
          where: { id },
          data: { providerRef },
        })
        return { claimed: false, tx: rowToTx(row), alreadyInStatus: true }
      }
      return { claimed: false, tx: rowToTx(existing), alreadyInStatus: true }
    }

    const where =
      status === 'succeeded'
        ? { id, status: { not: 'succeeded' as const } }
        : status === 'failed' || status === 'cancelled'
          ? { id, status: { notIn: TERMINAL_STATUSES } }
          : status === 'pending'
            ? { id, status: 'created' as const }
            : { id, status: { not: status } }

    try {
      const updated = await prisma.paymentTransaction.updateMany({
        where,
        data: {
          status,
          ...(providerRef !== undefined ? { providerRef } : {}),
        },
      })

      const row = await prisma.paymentTransaction.findUnique({ where: { id } })
      const tx = row ? rowToTx(row) : null
      return {
        claimed: updated.count > 0,
        tx,
        alreadyInStatus: updated.count === 0 && tx?.status === status,
      }
    } catch (err) {
      // pl. providerRef @unique ütközés – másik tx már birtokolja a refet
      console.warn('[payment-transactions] claim failed', { id, status, err })
      const row = await prisma.paymentTransaction.findUnique({ where: { id } })
      const tx = row ? rowToTx(row) : null
      return {
        claimed: false,
        tx,
        alreadyInStatus: tx?.status === status,
      }
    }
  }

  // Dev JSON fallback – process-lokális, de ugyanez a CAS logika
  const list = load()
  const idx = list.findIndex((t) => t.id === id)
  if (idx < 0) return { claimed: false, tx: null, alreadyInStatus: false }
  const current = list[idx]
  if (current.status === status) {
    if (providerRef !== undefined) current.providerRef = providerRef
    memoryStore = list
    save()
    return { claimed: false, tx: current, alreadyInStatus: true }
  }

  const canClaim =
    status === 'succeeded'
      ? current.status !== 'succeeded'
      : status === 'failed' || status === 'cancelled'
        ? !TERMINAL_STATUSES.includes(current.status)
        : status === 'pending'
          ? current.status === 'created'
          : true

  if (!canClaim) {
    return { claimed: false, tx: current, alreadyInStatus: false }
  }

  current.status = status
  if (providerRef !== undefined) current.providerRef = providerRef
  memoryStore = list
  save()
  console.debug('[payment-transactions] status claimed', { id, status })
  return { claimed: true, tx: current, alreadyInStatus: false }
}
