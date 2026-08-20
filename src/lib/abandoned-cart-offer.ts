/**
 * Elhagyott kosár kedvezmény: csak a befagyasztott termékekre és darabszámra.
 * Többlet qty és új tételek teljes áron maradnak (csalásvédelem).
 */
import type { CartItem, CartItemOptions } from '@/lib/cart-storage'

export type AbandonedCartPricedLine = {
  productId: string
  qty: number
  priceHuf: number
  options?: CartItemOptions
  parameters?: {
    colorName?: string
    colorHex?: string
    materialName?: string
  }
}

export type AbandonedCartEligibleItem = {
  productId: string
  qty: number
  options?: CartItemOptions
}

export type AbandonedCartOfferDiscount = {
  percent: number
  eligibleItems: AbandonedCartEligibleItem[]
}

function hasColor(options?: CartItemOptions): boolean {
  return Boolean(options?.colorHex?.trim() || options?.colorName?.trim())
}

function normalizeColor(options?: CartItemOptions): { hex: string; name: string } {
  return {
    hex: (options?.colorHex ?? '').trim().toLowerCase(),
    name: (options?.colorName ?? '').trim().toLowerCase(),
  }
}

/** Szín egyezés; üres eligible opció = termék szintű darabszám-plafon. */
export function eligibleOptionsMatch(
  eligible?: CartItemOptions,
  cart?: CartItemOptions
): boolean {
  if (!hasColor(eligible)) return true
  const a = normalizeColor(eligible)
  const b = normalizeColor(cart)
  if (a.hex && b.hex) return a.hex === b.hex
  if (a.name && b.name) return a.name === b.name
  if (a.hex && b.name) return a.hex === b.name
  if (a.name && b.hex) return a.name === b.hex
  return false
}

export function parseEligibleItems(raw: unknown): AbandonedCartEligibleItem[] {
  if (!Array.isArray(raw)) return []
  const out: AbandonedCartEligibleItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    const productId = String(row.productId ?? '').trim()
    const qty = Math.floor(Number(row.qty))
    if (!productId || !Number.isFinite(qty) || qty < 1) continue
    const opts = row.options as Record<string, unknown> | undefined
    const options =
      opts && (opts.colorName != null || opts.colorHex != null || opts.materialName != null)
        ? {
            colorName: opts.colorName != null ? String(opts.colorName) : undefined,
            colorHex: opts.colorHex != null ? String(opts.colorHex) : undefined,
            materialName: opts.materialName != null ? String(opts.materialName) : undefined,
          }
        : undefined
    out.push({ productId, qty, options })
  }
  return out
}

export function eligibleItemsFromCart(items: CartItem[]): AbandonedCartEligibleItem[] {
  const merged = new Map<string, AbandonedCartEligibleItem>()
  for (const item of items) {
    const productId = String(item.productId ?? '').trim()
    const qty = Math.floor(Number(item.qty) || 0)
    if (!productId || qty < 1) continue
    const options = item.options
    const key = `${productId}::${normalizeColor(options).hex}::${normalizeColor(options).name}`
    const prev = merged.get(key)
    if (prev) {
      prev.qty += qty
      continue
    }
    merged.set(key, { productId, qty, options: hasColor(options) ? options : undefined })
  }
  return [...merged.values()]
}

function lineOptions(line: AbandonedCartPricedLine): CartItemOptions | undefined {
  if (line.options) return line.options
  if (!line.parameters) return undefined
  const { colorName, colorHex, materialName } = line.parameters
  if (!colorName && !colorHex && !materialName) return undefined
  return { colorName, colorHex, materialName }
}

/**
 * A kosársorhoz felhasználható kedvezményes darabszám (pool-t fogyasztja).
 */
export function takeEligibleQty(
  pool: AbandonedCartEligibleItem[],
  productId: string,
  requestedQty: number,
  options?: CartItemOptions
): number {
  const requested = Math.max(0, Math.floor(requestedQty))
  if (requested <= 0) return 0
  let remaining = requested
  let granted = 0
  for (const entry of pool) {
    if (remaining <= 0) break
    if (entry.qty <= 0 || entry.productId !== productId) continue
    if (!eligibleOptionsMatch(entry.options, options)) continue
    const take = Math.min(entry.qty, remaining)
    entry.qty -= take
    granted += take
    remaining -= take
  }
  return granted
}

export function cloneEligiblePool(
  items: AbandonedCartEligibleItem[]
): AbandonedCartEligibleItem[] {
  return items.map((item) => ({
    productId: item.productId,
    qty: item.qty,
    options: item.options ? { ...item.options } : undefined,
  }))
}

function roundHuf(n: number): number {
  return Math.max(0, Math.round(n))
}

function proportionalShare(total: number, part: number, whole: number): number {
  if (total <= 0 || whole <= 0 || part <= 0) return 0
  return Math.round((total * part) / whole)
}

/** Nem-Szerencsekerék tételek kedvezményes (qty-capped) részösszege. */
export function computeEligibleSubtotalHuf(
  lines: AbandonedCartPricedLine[],
  eligibleItems: AbandonedCartEligibleItem[],
  spinProductIds: ReadonlySet<string> = new Set()
): number {
  const pool = cloneEligiblePool(eligibleItems)
  let subtotal = 0
  for (const line of lines) {
    if (spinProductIds.has(line.productId)) continue
    const qty = takeEligibleQty(pool, line.productId, line.qty, lineOptions(line))
    if (qty <= 0) continue
    subtotal += line.priceHuf * qty
  }
  return subtotal
}

/**
 * Elhagyott kosár % a hűség után, csak a befagyasztott qty-re.
 * A többlet darabszám és az új termékek kimaradnak.
 */
export function computeAbandonedCartDiscountHuf(
  lines: AbandonedCartPricedLine[],
  offer: AbandonedCartOfferDiscount,
  options?: {
    spinProductIds?: ReadonlySet<string>
    loyaltyDiscountHuf?: number
    cartSubtotalHuf?: number
  }
): number {
  const percent = offer.percent
  if (!Number.isFinite(percent) || percent <= 0) return 0
  const spinProductIds = options?.spinProductIds ?? new Set()
  const eligibleSubtotal = computeEligibleSubtotalHuf(lines, offer.eligibleItems, spinProductIds)
  if (eligibleSubtotal <= 0) return 0
  const cartSubtotal = options?.cartSubtotalHuf ?? lines.reduce((s, l) => s + l.priceHuf * l.qty, 0)
  const loyaltyShare = proportionalShare(
    options?.loyaltyDiscountHuf ?? 0,
    eligibleSubtotal,
    cartSubtotal
  )
  const base = Math.max(0, eligibleSubtotal - loyaltyShare)
  const cappedPercent = Math.min(percent, 1)
  return Math.min(base, roundHuf(base * cappedPercent))
}

export function isAbandonedCartSource(source: string | null | undefined): boolean {
  return source === 'abandoned_cart'
}
