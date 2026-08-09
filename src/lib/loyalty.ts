/**
 * Hűségkedvezmény: emailhez kötött, minősített fizetett vásárlásszám alapján.
 * Csak küszöböt elérő rendelések számítanak; vásárlásonként +1%, max 8%.
 * Nem összevonható más kuponnal.
 */

export type LoyaltyTier = 'bronze' | 'silver' | 'gold'

/** Hűségszint a minősített rendelésszám alapján. 0 rendelés → null (nincs badge). */
export function getLoyaltyTier(orderCount: number): LoyaltyTier | null {
  if (orderCount <= 0) return null
  if (orderCount <= 2) return 'bronze'
  if (orderCount <= 5) return 'silver'
  return 'gold'
}

export type LoyaltyRecord = {
  email: string
  qualifyingPaidOrdersCount: number
  loyaltyPercent: number
  lastUpdatedAt: string // ISO
}

const LOYALTY_THRESHOLD_HUF = 50000
const LOYALTY_MAX_PERCENT = 8
const LOYALTY_FILE = 'data/loyalty.json'

function getFxHufPerEur(): number {
  const v = process.env.FX_HUF_PER_EUR
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : 390
}

/** EUR küszöb: 50 000 Ft / árfolyam, 2 tizedes. */
export function getThresholdEur(): number {
  const fx = getFxHufPerEur()
  return Math.round((LOYALTY_THRESHOLD_HUF / fx) * 100) / 100
}

export function getThresholdHuf(): number {
  return LOYALTY_THRESHOLD_HUF
}

/** Stripe amount_total alapján minősül-e a vásárlás (HUF zero-decimal, EUR cent). */
export function qualifiesForLoyalty(amountTotal: number, currency: string): boolean {
  const curr = (currency || 'huf').toLowerCase()
  if (curr === 'huf') {
    return amountTotal >= LOYALTY_THRESHOLD_HUF
  }
  if (curr === 'eur') {
    const amountEur = amountTotal / 100
    return amountEur >= getThresholdEur()
  }
  return false
}

let memoryStore: LoyaltyRecord[] = []
let loaded = false

function getLoyaltyPath(): string {
  const path = require('path')
  return path.join(process.cwd(), LOYALTY_FILE)
}

function loadLoyalty(): LoyaltyRecord[] {
  if (loaded) return memoryStore
  try {
    const fs = require('fs')
    const p = getLoyaltyPath()
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

function saveLoyalty(): void {
  try {
    const fs = require('fs')
    const path = require('path')
    const p = getLoyaltyPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(p, JSON.stringify(memoryStore, null, 2), 'utf-8')
  } catch {
    // Élesben DB
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function getLoyaltyByEmail(email: string): LoyaltyRecord | null {
  const records = loadLoyalty()
  const key = normalizeEmail(email)
  return records.find((r) => normalizeEmail(r.email) === key) ?? null
}

/** Minősített vásárlás növelése (idempotenciát a hívó biztosítja: countedForLoyalty flag). */
export function incrementQualifyingOrder(email: string): LoyaltyRecord {
  const records = loadLoyalty()
  const key = normalizeEmail(email)
  const idx = records.findIndex((r) => normalizeEmail(r.email) === key)
  const now = new Date().toISOString()
  let record: LoyaltyRecord
  if (idx >= 0) {
    record = records[idx]
    record.qualifyingPaidOrdersCount += 1
    record.loyaltyPercent = Math.min(record.qualifyingPaidOrdersCount, LOYALTY_MAX_PERCENT)
    record.lastUpdatedAt = now
  } else {
    record = {
      email: key,
      qualifyingPaidOrdersCount: 1,
      loyaltyPercent: 1,
      lastUpdatedAt: now,
    }
    records.push(record)
  }
  memoryStore = records
  saveLoyalty()
  return record
}

/** Teljes visszatérítés: -1 count (min 0). */
export function decrementQualifyingOrder(email: string): LoyaltyRecord | null {
  const records = loadLoyalty()
  const key = normalizeEmail(email)
  const idx = records.findIndex((r) => normalizeEmail(r.email) === key)
  if (idx < 0) return null
  const record = records[idx]
  record.qualifyingPaidOrdersCount = Math.max(0, record.qualifyingPaidOrdersCount - 1)
  record.loyaltyPercent = Math.min(record.qualifyingPaidOrdersCount, LOYALTY_MAX_PERCENT)
  record.lastUpdatedAt = new Date().toISOString()
  if (record.qualifyingPaidOrdersCount === 0) {
    records.splice(idx, 1)
  }
  memoryStore = records
  saveLoyalty()
  return record
}
