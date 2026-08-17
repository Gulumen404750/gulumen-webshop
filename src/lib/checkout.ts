/**
 * Checkout számítási logika – waterfall kedvezmények + szállítás.
 * Forrás igazság a szerveren; a kliens ugyanezt a függvényt használja előnézethez.
 *
 * Sorrend:
 * 1. Regisztrációs / kupon kedvezmény (% vagy fix Ft) – csak teljes árú tételekre
 * 2. Szerencsekerék (15/20/25% a spin listában lévő termékek zárolt árából; +5% ponttal)
 * 3. Pontbeváltás (max. a fennmaradó összeg 30%-a)
 * 4. Szállítási díj (ha a végső áruösszeg < FREE_SHIPPING_THRESHOLD)
 */

import type { Product } from '@/lib/data'
import type { OrderItem } from '@/lib/orders'
import { cartOptionsToParameters, type OrderItemParameters } from '@/lib/production-payload'
import { isSaleActive } from '@/lib/storefront-config'
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
  STANDARD_SHIPPING_FEE_HUF,
} from '@/lib/gamification/constants'
import {
  computeLuckySpinDiscount,
  calculateLuckySpinDiscountPercent,
  type LuckySpinRecord,
  type LuckySpinDiscountResult,
} from '@/lib/gamification/lucky-spin'
import {
  hufToPoints,
  maxPointsDiscountHuf,
  pointsToHuf,
  splitPointsDiscount,
  splitPointsUsed,
} from '@/lib/gamification/purchase-points'

export {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE_HUF,
  POINTS_PER_HUF,
  MAX_CART_POINTS_COVERAGE,
}

/** Szerencsekerék kedvezmény % – darabszám és pontbeváltás alapján. */
export function calculateDiscount(itemCount: number, usePoints = false): number {
  return calculateLuckySpinDiscountPercent(itemCount, usePoints)
}

/**
 * Legacy engedélyezett kupon %-ok.
 * Az új manuális választásnál a plafon (MAX_COMBINED_COUPON_PERCENT = 20%) az irányadó.
 */
export const ALLOWED_COUPON_PERCENTS = [0, 0.05, 0.1, 0.15, 0.2] as const

export type CheckoutCartLineInput = {
  productId: string
  qty: number
  options?: {
    colorName?: string
    colorHex?: string
    materialName?: string
  }
}

export type ResolvedCartLine = {
  productId: string
  qty: number
  priceHuf: number
  fulfillmentType: 'stock' | 'procurement'
  name?: string
  parameters?: OrderItemParameters
}

export type CouponDiscount = {
  /** 0–1 közötti százalék (pl. 0.1 = 10%). */
  percent?: number
  /** Fix Ft levonás (regisztrációs kupon fix érték esetén). */
  fixedHuf?: number
}

export type PointsRedemptionInput = {
  requestedDiscountHuf: number
  userBalance: number
}

export type CheckoutOrderSplit = {
  items: OrderItem[]
  subtotalHuf: number
  couponDiscountHuf: number
  luckySpinDiscountHuf: number
  pointsDiscountHuf: number
  pointsUsed: number
  merchandiseTotalHuf: number
  shippingHuf: number
  totalHuf: number
}

export type CheckoutTotals = {
  lines: ResolvedCartLine[]
  subtotalHuf: number
  couponDiscountHuf: number
  luckySpinDiscountHuf: number
  afterCouponAndLuckyHuf: number
  pointsDiscountHuf: number
  pointsUsed: number
  merchandiseTotalHuf: number
  shippingHuf: number
  finalTotalHuf: number
  freeShippingRemainingHuf: number
  luckySpin: LuckySpinDiscountResult
  inStock: CheckoutOrderSplit
  sourcing: CheckoutOrderSplit
}

function roundHuf(n: number): number {
  return Math.max(0, Math.round(n))
}

/** Szerver: kliens által küldött kupon % validálása (max. 20% plafon). */
export function validateCouponPercent(percent: number, isLoggedIn: boolean): boolean {
  if (percent <= 0) return true
  if (!isLoggedIn) return false
  if (percent > 0.2 + 1e-9) return false
  // Elfogadjuk a plafon alatti bármely érvényes kombinációt (5/10/15/20 és köztesek).
  return percent <= 0.2 + 1e-9
}

export function resolveCartLines(
  items: CheckoutCartLineInput[],
  productMap: Map<string, Product>
): ResolvedCartLine[] {
  const lines: ResolvedCartLine[] = []
  for (const { productId, qty, options } of items) {
    const product = productMap.get(productId)
    if (!product || qty < 1) continue
    // Csak aktív akcióablakban alkalmazható a discountPriceHuf (különben undercharge).
    const priceHuf =
      isSaleActive(product) && product.discountPriceHuf != null
        ? product.discountPriceHuf
        : product.priceHuf
    lines.push({
      productId,
      qty,
      priceHuf,
      fulfillmentType: product.type === 'sourcing_deal' ? 'procurement' : 'stock',
      name: product.name,
      parameters: cartOptionsToParameters(options),
    })
  }
  return lines
}

function lineSubtotalHuf(lines: ResolvedCartLine[]): number {
  return lines.reduce((s, l) => s + l.priceHuf * l.qty, 0)
}

function filterLinesBySpin(
  lines: ResolvedCartLine[],
  spinProductIds: ReadonlySet<string>,
  spinOnly: boolean
): ResolvedCartLine[] {
  return lines.filter((l) => spinProductIds.has(l.productId) === spinOnly)
}

/** 1. lépés: kupon kedvezmény – csak teljes árú (nem Szerencsekerék) tételekre. */
export function computeCouponDiscountHuf(
  lines: ResolvedCartLine[],
  coupon: CouponDiscount,
  spinProductIds: ReadonlySet<string> = new Set()
): number {
  const fullPriceSubtotal = lineSubtotalHuf(filterLinesBySpin(lines, spinProductIds, false))
  if (fullPriceSubtotal <= 0) return 0
  const fixed = coupon.fixedHuf ?? 0
  const percent = coupon.percent ?? 0
  const fromPercent = percent > 0 ? roundHuf(fullPriceSubtotal * percent) : 0
  return Math.min(fullPriceSubtotal, roundHuf(fixed + fromPercent))
}

/** 3. lépés: pontbeváltás – max. 30% a kupon+spin utáni összegből. */
export function computePointsRedemption(
  orderTotalAfterDiscountsHuf: number,
  input: PointsRedemptionInput
): { pointsDiscountHuf: number; pointsUsed: number } {
  if (orderTotalAfterDiscountsHuf <= 0 || input.requestedDiscountHuf <= 0) {
    return { pointsDiscountHuf: 0, pointsUsed: 0 }
  }

  const maxHuf = maxPointsDiscountHuf(orderTotalAfterDiscountsHuf)
  const pointsDiscountHuf = Math.min(
    Math.floor(input.requestedDiscountHuf),
    maxHuf,
    orderTotalAfterDiscountsHuf
  )
  const pointsUsed = hufToPoints(pointsDiscountHuf)
  if (pointsUsed <= 0) {
    return { pointsDiscountHuf: 0, pointsUsed: 0 }
  }
  if (input.userBalance < pointsUsed) {
    return { pointsDiscountHuf: 0, pointsUsed: 0 }
  }
  return { pointsDiscountHuf, pointsUsed }
}

/** 4. lépés: szállítási díj a kedvezmények és pontok UTÁN. */
export function computeShippingHuf(merchandiseTotalHuf: number): number {
  if (merchandiseTotalHuf <= 0) return 0
  if (merchandiseTotalHuf >= FREE_SHIPPING_THRESHOLD) return 0
  return STANDARD_SHIPPING_FEE_HUF
}

export function computeFreeShippingRemainingHuf(merchandiseTotalHuf: number): number {
  if (merchandiseTotalHuf >= FREE_SHIPPING_THRESHOLD) return 0
  return Math.max(0, FREE_SHIPPING_THRESHOLD - merchandiseTotalHuf)
}

function emptySplit(): CheckoutOrderSplit {
  return {
    items: [],
    subtotalHuf: 0,
    couponDiscountHuf: 0,
    luckySpinDiscountHuf: 0,
    pointsDiscountHuf: 0,
    pointsUsed: 0,
    merchandiseTotalHuf: 0,
    shippingHuf: 0,
    totalHuf: 0,
  }
}

function proportionalShare(total: number, part: number, whole: number): number {
  if (total <= 0 || whole <= 0 || part <= 0) return 0
  return Math.round((total * part) / whole)
}

function buildOrderSplit(
  lines: ResolvedCartLine[],
  fulfillmentType: 'stock' | 'procurement',
  couponDiscountHuf: number,
  luckySpinDiscountHuf: number,
  pointsDiscountHuf: number,
  pointsUsed: number,
  shippingHuf: number,
  combinedMerchandiseBeforeShipping: number,
  spinProductIds: ReadonlySet<string>
): CheckoutOrderSplit {
  const splitLines = lines.filter((l) => l.fulfillmentType === fulfillmentType)
  if (splitLines.length === 0) return emptySplit()

  const subtotalHuf = lineSubtotalHuf(splitLines)
  const fullPriceSubtotal = lineSubtotalHuf(filterLinesBySpin(lines, spinProductIds, false))
  const spinSubtotal = lineSubtotalHuf(filterLinesBySpin(lines, spinProductIds, true))
  const splitFullPriceSubtotal = lineSubtotalHuf(filterLinesBySpin(splitLines, spinProductIds, false))
  const splitSpinSubtotal = lineSubtotalHuf(filterLinesBySpin(splitLines, spinProductIds, true))

  const couponShare = proportionalShare(couponDiscountHuf, splitFullPriceSubtotal, fullPriceSubtotal)
  const luckyShare = proportionalShare(luckySpinDiscountHuf, splitSpinSubtotal, spinSubtotal)
  const pointsShare = proportionalShare(
    pointsDiscountHuf,
    subtotalHuf,
    combinedMerchandiseBeforeShipping + pointsDiscountHuf
  )
  const pointsUsedShare = proportionalShare(pointsUsed, pointsShare, pointsDiscountHuf)

  const merchandiseTotalHuf = Math.max(0, subtotalHuf - couponShare - luckyShare - pointsShare)

  const items: OrderItem[] = splitLines.map((l) => ({
    productId: l.productId,
    qty: l.qty,
    fulfillmentType: l.fulfillmentType,
    priceHuf: l.priceHuf,
    name: l.name,
    parameters: l.parameters,
  }))

  return {
    items,
    subtotalHuf,
    couponDiscountHuf: couponShare,
    luckySpinDiscountHuf: luckyShare,
    pointsDiscountHuf: pointsShare,
    pointsUsed: pointsUsedShare,
    merchandiseTotalHuf,
    shippingHuf,
    totalHuf: merchandiseTotalHuf + shippingHuf,
  }
}

export function applyLuckySpinLockedPrices(
  lines: ResolvedCartLine[],
  spin: LuckySpinRecord | null
): ResolvedCartLine[] {
  if (!spin?.priceSnapshot) return lines
  return lines.map((line) => {
    const locked = spin.priceSnapshot?.[line.productId]
    if (locked == null || locked <= 0) return line
    return { ...line, priceHuf: locked }
  })
}

export type ComputeCheckoutTotalsParams = {
  lines: ResolvedCartLine[]
  coupon: CouponDiscount
  luckySpin: LuckySpinRecord | null
  points?: PointsRedemptionInput
  now?: Date
}

/**
 * Teljes checkout waterfall – tiszta függvény, DB nélkül.
 */
export function computeCheckoutTotals(params: ComputeCheckoutTotalsParams): CheckoutTotals {
  const { lines: rawLines, coupon, luckySpin, points, now = new Date() } = params
  const lines = applyLuckySpinLockedPrices(rawLines, luckySpin)

  const subtotalHuf = lineSubtotalHuf(lines)
  const spinProductIds = new Set(luckySpin?.productIds ?? [])
  const couponDiscountHuf = computeCouponDiscountHuf(lines, coupon, spinProductIds)

  const discountItems = lines.map((l) => ({
    productId: l.productId,
    qty: l.qty,
    priceHuf: l.priceHuf,
  }))
  const usePointsForSpin = !!(points && points.requestedDiscountHuf > 0)
  const luckySpinResult = computeLuckySpinDiscount(discountItems, luckySpin, now, usePointsForSpin)
  const luckySpinDiscountHuf = luckySpinResult.discountHuf

  const afterCouponAndLuckyHuf = Math.max(0, subtotalHuf - couponDiscountHuf - luckySpinDiscountHuf)

  let pointsDiscountHuf = 0
  let pointsUsed = 0
  if (points && points.requestedDiscountHuf > 0) {
    const redemption = computePointsRedemption(afterCouponAndLuckyHuf, points)
    pointsDiscountHuf = redemption.pointsDiscountHuf
    pointsUsed = redemption.pointsUsed
  }

  const merchandiseTotalHuf = Math.max(0, afterCouponAndLuckyHuf - pointsDiscountHuf)
  const shippingHuf = computeShippingHuf(merchandiseTotalHuf)
  const finalTotalHuf = merchandiseTotalHuf + shippingHuf
  const freeShippingRemainingHuf = computeFreeShippingRemainingHuf(merchandiseTotalHuf)

  const stockSubtotal = lines
    .filter((l) => l.fulfillmentType === 'stock')
    .reduce((s, l) => s + l.priceHuf * l.qty, 0)

  const inStockShipping = stockSubtotal > 0 ? shippingHuf : 0
  const sourcingShipping = stockSubtotal <= 0 ? shippingHuf : 0

  const inStock = buildOrderSplit(
    lines,
    'stock',
    couponDiscountHuf,
    luckySpinDiscountHuf,
    pointsDiscountHuf,
    pointsUsed,
    inStockShipping,
    merchandiseTotalHuf,
    spinProductIds
  )
  const sourcing = buildOrderSplit(
    lines,
    'procurement',
    couponDiscountHuf,
    luckySpinDiscountHuf,
    pointsDiscountHuf,
    pointsUsed,
    sourcingShipping,
    merchandiseTotalHuf,
    spinProductIds
  )

  return {
    lines,
    subtotalHuf,
    couponDiscountHuf,
    luckySpinDiscountHuf,
    afterCouponAndLuckyHuf,
    pointsDiscountHuf,
    pointsUsed,
    merchandiseTotalHuf,
    shippingHuf,
    finalTotalHuf,
    freeShippingRemainingHuf,
    luckySpin: luckySpinResult,
    inStock,
    sourcing,
  }
}

/** Kliens előnézet: max. felhasználható pontok Ft-ban. */
export function previewMaxPointsDiscount(
  orderTotalAfterDiscountsHuf: number,
  userBalance: number
): { maxUsablePointsDiscountHuf: number; maxUsablePoints: number } {
  const maxHuf = maxPointsDiscountHuf(orderTotalAfterDiscountsHuf)
  const maxByBalanceHuf = pointsToHuf(userBalance)
  const usableDiscountHuf = Math.min(maxHuf, maxByBalanceHuf, orderTotalAfterDiscountsHuf)
  return {
    maxUsablePointsDiscountHuf: usableDiscountHuf,
    maxUsablePoints: hufToPoints(usableDiscountHuf),
  }
}

export { splitPointsDiscount, splitPointsUsed }
