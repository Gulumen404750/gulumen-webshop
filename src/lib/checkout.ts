/**
 * Checkout számítási logika – waterfall kedvezmények + szállítás.
 * Forrás igazság a szerveren; a kliens ugyanezt a függvényt használja előnézethez.
 *
 * Sorrend:
 * 1. Hűségkedvezmény (1–8%, automatikus, a teljes kosárra)
 * 2. Extra kedvezmény – egyszerre csak egy:
 *    kupon (fix Ft + max. 15% százalékos) VAGY pontfelhasználás VAGY Szerencsekerék
 * 3. Szállítási díj (a pont nem fedezi; 25 000 Ft felett, csak ponttal fizetve is fizetendő)
 */

import type { Product } from '@/lib/data'
import type { OrderItem } from '@/lib/orders'
import { cartOptionsToParameters, type OrderItemParameters } from '@/lib/production-payload'
import { defaultMaterialForProduct } from '@/lib/filamentMaterials'
import {
  getAvailableColorVariants,
  getBaseColorVariant,
  getFilamentColorName,
} from '@/lib/filamentColors'
import { isSaleActive } from '@/lib/storefront-config'
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
  STANDARD_SHIPPING_FEE_HUF,
} from '@/lib/gamification/constants'
import { MAX_COMBINED_COUPON_PERCENT, capLoyaltyPercent, hasCouponExtraDiscount } from '@/lib/coupon-config'
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
  computeMixedPointsRedemption,
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
 * Az új manuális választásnál a plafon (MAX_COMBINED_COUPON_PERCENT = 15%) az irányadó.
 */
export const ALLOWED_COUPON_PERCENTS = [0, 0.05, 0.1, 0.15] as const

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
  /** NFC / ajándékpont – 100%-ban levásárolható a termékárra. */
  giftPointsAvailable?: number
  /** Ajándékpont-tárca felhasználása (alap: igen). */
  spendGift?: boolean
  /** Aktivitási pont-tárca felhasználása, 1:1 a termékár 100%-áig (alap: igen). */
  spendActivity?: boolean
}

export type CheckoutOrderSplit = {
  items: OrderItem[]
  subtotalHuf: number
  couponDiscountHuf: number
  luckySpinDiscountHuf: number
  pointsDiscountHuf: number
  pointsUsed: number
  giftPointsUsed: number
  activityPointsUsed: number
  merchandiseTotalHuf: number
  shippingHuf: number
  totalHuf: number
  invoiceMerchandiseHuf: number
  invoiceShippingHuf: number
  invoiceTotalHuf: number
}

export type CheckoutTotals = {
  lines: ResolvedCartLine[]
  subtotalHuf: number
  loyaltyDiscountHuf: number
  couponDiscountHuf: number
  percentCouponDiscountHuf: number
  fixedCouponDiscountHuf: number
  fixedCouponUnusedHuf: number
  luckySpinDiscountHuf: number
  afterCouponAndLuckyHuf: number
  pointsDiscountHuf: number
  pointsUsed: number
  giftPointsUsed: number
  activityPointsUsed: number
  merchandiseTotalHuf: number
  shippingHuf: number
  finalTotalHuf: number
  /** Ponttal nem fedezett termékár – ez kerül számlára (kártya). */
  invoiceMerchandiseHuf: number
  invoiceShippingHuf: number
  invoiceTotalHuf: number
  freeShippingRemainingHuf: number
  luckySpin: LuckySpinDiscountResult
  inStock: CheckoutOrderSplit
  sourcing: CheckoutOrderSplit
}

function roundHuf(n: number): number {
  return Math.max(0, Math.round(n))
}

/** Szerver: kliens által küldött kupon % validálása (max. 15% plafon, összevonás nélkül). */
export function validateCouponPercent(percent: number, isLoggedIn: boolean): boolean {
  if (percent <= 0) return true
  if (!isLoggedIn) return false
  return percent <= MAX_COMBINED_COUPON_PERCENT + 1e-9
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
    // Anyag csak adminban állítható; a vendég kosárértéke nem írhatja felül.
    const materialName = defaultMaterialForProduct(product.materials) ?? undefined
    let colorName = options?.colorName?.trim()
    let colorHex = options?.colorHex?.trim()
    if (!colorName && !colorHex) {
      const colors = getAvailableColorVariants(product.colorImages, !!product.isColorable)
      const base = getBaseColorVariant(colors) ?? colors[0] ?? null
      if (base) {
        colorName = getFilamentColorName(base, 'hu')
        colorHex = base.hex
      }
    }
    lines.push({
      productId,
      qty,
      priceHuf,
      fulfillmentType: product.type === 'sourcing_deal' ? 'procurement' : 'stock',
      name: product.name,
      parameters: cartOptionsToParameters({
        colorName,
        colorHex,
        materialName,
      }),
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

/** 2. lépés: százalékos kupon – csak teljes árú (nem Szerencsekerék) tételekre. */
export function computeCouponDiscountHuf(
  lines: ResolvedCartLine[],
  coupon: CouponDiscount,
  spinProductIds: ReadonlySet<string> = new Set()
): number {
  const fullPriceSubtotal = lineSubtotalHuf(filterLinesBySpin(lines, spinProductIds, false))
  if (fullPriceSubtotal <= 0) return 0
  const percent = coupon.percent ?? 0
  const fromPercent = percent > 0 ? roundHuf(fullPriceSubtotal * percent) : 0
  return Math.min(fullPriceSubtotal, fromPercent)
}

/**
 * Fix Ft kupon a fennmaradó termékárra. Egyszeri, egyben felhasználás:
 * a kosárnál nagyobb rész nem jár vissza, a fel nem használt maradék elveszik.
 */
export function applyFixedCouponHuf(
  remainingHuf: number,
  fixedHuf: number | undefined
): { appliedHuf: number; unusedHuf: number } {
  const fixed = typeof fixedHuf === 'number' && Number.isFinite(fixedHuf) ? Math.max(0, roundHuf(fixedHuf)) : 0
  if (fixed <= 0) return { appliedHuf: 0, unusedHuf: 0 }
  const remaining = Math.max(0, roundHuf(remainingHuf))
  const appliedHuf = Math.min(remaining, fixed)
  return { appliedHuf, unusedHuf: fixed - appliedHuf }
}

/**
 * Fix + százalékos kupon együtt: (Kosár értéke - Fix kupon) * (1 - Százalékos kupon).
 * A fel nem használt fix maradék nem jár vissza.
 */
export function stackFixedThenPercent(
  cartHuf: number,
  fixedHuf: number | undefined,
  percent: number | undefined
): {
  appliedFixedHuf: number
  unusedFixedHuf: number
  percentDiscountHuf: number
  remainingHuf: number
} {
  const cart = Math.max(0, roundHuf(cartHuf))
  const fixed = applyFixedCouponHuf(cart, fixedHuf)
  const afterFixed = Math.max(0, cart - fixed.appliedHuf)
  const p = typeof percent === 'number' && Number.isFinite(percent) ? Math.max(0, percent) : 0
  const percentDiscountHuf = p > 0 ? Math.min(afterFixed, roundHuf(afterFixed * p)) : 0
  return {
    appliedFixedHuf: fixed.appliedHuf,
    unusedFixedHuf: fixed.unusedHuf,
    percentDiscountHuf,
    remainingHuf: Math.max(0, afterFixed - percentDiscountHuf),
  }
}

/** 3. lépés: pontbeváltás – ajándék- és aktivitási pont 1:1 a termékár 100%-áig, soha nem a szállításra. */
export function computePointsRedemption(
  orderTotalAfterDiscountsHuf: number,
  input: PointsRedemptionInput
): {
  pointsDiscountHuf: number
  pointsUsed: number
  giftPointsUsed: number
  activityPointsUsed: number
} {
  const mixed = computeMixedPointsRedemption({
    merchandiseHuf: orderTotalAfterDiscountsHuf,
    requestedDiscountHuf: input.requestedDiscountHuf,
    userBalance: input.userBalance,
    giftPointsAvailable: input.giftPointsAvailable ?? 0,
    spendGift: input.spendGift,
    spendActivity: input.spendActivity,
  })
  return {
    pointsDiscountHuf: mixed.pointsDiscountHuf,
    pointsUsed: mixed.pointsUsed,
    giftPointsUsed: mixed.giftPointsUsed,
    activityPointsUsed: mixed.activityPointsUsed,
  }
}

/**
 * 4. lépés: szállítási díj.
 * A pont soha nem fedezi a szállítást. Ha a termékár teljesen ponttal van kifizetve
 * (maradék 0), a szállítás akkor is fizetendő – 25 000 Ft feletti kosárnál is.
 * Részleges pontfizetésnél a kártyán maradó termékár számít az ingyenes küszöbhöz.
 */
export function computeShippingHuf(
  merchandiseTotalHuf: number,
  options?: { hasItems?: boolean }
): number {
  const hasItems = options?.hasItems ?? merchandiseTotalHuf > 0
  if (merchandiseTotalHuf <= 0) {
    return hasItems ? STANDARD_SHIPPING_FEE_HUF : 0
  }
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
    giftPointsUsed: 0,
    activityPointsUsed: 0,
    merchandiseTotalHuf: 0,
    shippingHuf: 0,
    totalHuf: 0,
    invoiceMerchandiseHuf: 0,
    invoiceShippingHuf: 0,
    invoiceTotalHuf: 0,
  }
}

function proportionalShare(total: number, part: number, whole: number): number {
  if (total <= 0 || whole <= 0 || part <= 0) return 0
  return Math.round((total * part) / whole)
}

function buildOrderSplit(
  lines: ResolvedCartLine[],
  fulfillmentType: 'stock' | 'procurement',
  percentCouponDiscountHuf: number,
  fixedCouponDiscountHuf: number,
  loyaltyDiscountHuf: number,
  luckySpinDiscountHuf: number,
  pointsDiscountHuf: number,
  pointsUsed: number,
  giftPointsUsed: number,
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
  const cartSubtotal = lineSubtotalHuf(lines)

  const loyaltyShare = proportionalShare(loyaltyDiscountHuf, subtotalHuf, cartSubtotal)
  const fixedShare = proportionalShare(fixedCouponDiscountHuf, subtotalHuf, cartSubtotal)
  const percentShare = proportionalShare(
    percentCouponDiscountHuf,
    splitFullPriceSubtotal,
    fullPriceSubtotal
  )
  const luckyShare = proportionalShare(luckySpinDiscountHuf, splitSpinSubtotal, spinSubtotal)
  const couponShare = percentShare + fixedShare
  const merchandiseBeforePoints = Math.max(
    0,
    subtotalHuf - couponShare - loyaltyShare - luckyShare
  )
  const pointsShare = proportionalShare(
    pointsDiscountHuf,
    merchandiseBeforePoints,
    combinedMerchandiseBeforeShipping + pointsDiscountHuf
  )
  const pointsUsedShare = proportionalShare(pointsUsed, pointsShare, pointsDiscountHuf)
  const giftPointsUsedShare = proportionalShare(giftPointsUsed, pointsShare, pointsDiscountHuf)
  const activityPointsUsedShare = Math.max(0, pointsUsedShare - giftPointsUsedShare)

  const merchandiseTotalHuf = Math.max(
    0,
    subtotalHuf - couponShare - loyaltyShare - luckyShare - pointsShare
  )
  const totalHuf = merchandiseTotalHuf + shippingHuf

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
    couponDiscountHuf: couponShare + loyaltyShare,
    luckySpinDiscountHuf: luckyShare,
    pointsDiscountHuf: pointsShare,
    pointsUsed: pointsUsedShare,
    giftPointsUsed: giftPointsUsedShare,
    activityPointsUsed: activityPointsUsedShare,
    merchandiseTotalHuf,
    shippingHuf,
    totalHuf,
    invoiceMerchandiseHuf: merchandiseTotalHuf,
    invoiceShippingHuf: shippingHuf,
    invoiceTotalHuf: totalHuf,
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
  /** 0–1 hűségkedvezmény (max. 8%), automatikus; a kupon/pont/Szerencsekerék extra mellett is megmarad. */
  loyaltyPercent?: number
  now?: Date
}

/**
 * Teljes checkout waterfall – tiszta függvény, DB nélkül.
 */
export function computeCheckoutTotals(params: ComputeCheckoutTotalsParams): CheckoutTotals {
  const { lines: rawLines, coupon, luckySpin, points, loyaltyPercent, now = new Date() } = params
  const lines = applyLuckySpinLockedPrices(rawLines, luckySpin)

  const subtotalHuf = lineSubtotalHuf(lines)
  const loyaltyFraction = capLoyaltyPercent(loyaltyPercent ?? 0)
  const loyaltyDiscountHuf = loyaltyFraction > 0 ? roundHuf(subtotalHuf * loyaltyFraction) : 0
  const spinProductIds = new Set(luckySpin?.productIds ?? [])
  const fullPriceSubtotal = lineSubtotalHuf(filterLinesBySpin(lines, spinProductIds, false))
  const afterLoyaltyHuf = Math.max(0, subtotalHuf - loyaltyDiscountHuf)
  const hasCouponExtra = hasCouponExtraDiscount(coupon)
  const wantsPoints = Boolean(points && points.requestedDiscountHuf > 0)

  const fixedApplication = applyFixedCouponHuf(afterLoyaltyHuf, coupon.fixedHuf)
  const afterFixedHuf = Math.max(0, afterLoyaltyHuf - fixedApplication.appliedHuf)
  const nonSpinRemainingHuf = proportionalShare(afterFixedHuf, fullPriceSubtotal, subtotalHuf)
  const spinRemainingHuf = Math.max(0, afterFixedHuf - nonSpinRemainingHuf)

  const percent = coupon.percent ?? 0
  const percentCouponDiscountHuf =
    percent <= 0
      ? 0
      : Math.min(nonSpinRemainingHuf, roundHuf(nonSpinRemainingHuf * percent))

  const discountItems = lines.map((l) => ({
    productId: l.productId,
    qty: l.qty,
    priceHuf: l.priceHuf,
  }))
  const luckySpinResult = computeLuckySpinDiscount(discountItems, luckySpin, now, false)
  const applyLuckySpin = luckySpinResult.active && !hasCouponExtra && !wantsPoints
  const luckySpinDiscountHuf =
    !applyLuckySpin
      ? 0
      : Math.min(
          spinRemainingHuf,
          roundHuf(spinRemainingHuf * luckySpinResult.discountPercent)
        )
  const couponDiscountHuf = percentCouponDiscountHuf + fixedApplication.appliedHuf

  const afterCouponAndLuckyHuf = Math.max(
    0,
    afterFixedHuf - percentCouponDiscountHuf - luckySpinDiscountHuf
  )

  let pointsDiscountHuf = 0
  let pointsUsed = 0
  let giftPointsUsed = 0
  let activityPointsUsed = 0
  if (wantsPoints && !hasCouponExtra && points) {
    const redemption = computePointsRedemption(afterCouponAndLuckyHuf, points)
    pointsDiscountHuf = redemption.pointsDiscountHuf
    pointsUsed = redemption.pointsUsed
    giftPointsUsed = redemption.giftPointsUsed
    activityPointsUsed = redemption.activityPointsUsed
  }

  const merchandiseTotalHuf = Math.max(0, afterCouponAndLuckyHuf - pointsDiscountHuf)
  const shippingHuf = computeShippingHuf(merchandiseTotalHuf, {
    hasItems: lines.length > 0,
  })
  const finalTotalHuf = merchandiseTotalHuf + shippingHuf
  const freeShippingRemainingHuf =
    merchandiseTotalHuf <= 0 && pointsUsed > 0
      ? 0
      : computeFreeShippingRemainingHuf(merchandiseTotalHuf)

  const stockSubtotal = lines
    .filter((l) => l.fulfillmentType === 'stock')
    .reduce((s, l) => s + l.priceHuf * l.qty, 0)

  const inStockShipping = stockSubtotal > 0 ? shippingHuf : 0
  const sourcingShipping = stockSubtotal <= 0 ? shippingHuf : 0

  const inStock = buildOrderSplit(
    lines,
    'stock',
    percentCouponDiscountHuf,
    fixedApplication.appliedHuf,
    loyaltyDiscountHuf,
    luckySpinDiscountHuf,
    pointsDiscountHuf,
    pointsUsed,
    giftPointsUsed,
    inStockShipping,
    merchandiseTotalHuf,
    spinProductIds
  )
  const sourcing = buildOrderSplit(
    lines,
    'procurement',
    percentCouponDiscountHuf,
    fixedApplication.appliedHuf,
    loyaltyDiscountHuf,
    luckySpinDiscountHuf,
    pointsDiscountHuf,
    pointsUsed,
    giftPointsUsed,
    sourcingShipping,
    merchandiseTotalHuf,
    spinProductIds
  )

  return {
    lines,
    subtotalHuf,
    loyaltyDiscountHuf,
    couponDiscountHuf,
    percentCouponDiscountHuf,
    fixedCouponDiscountHuf: fixedApplication.appliedHuf,
    fixedCouponUnusedHuf: fixedApplication.unusedHuf,
    luckySpinDiscountHuf,
    afterCouponAndLuckyHuf,
    pointsDiscountHuf,
    pointsUsed,
    giftPointsUsed,
    activityPointsUsed,
    merchandiseTotalHuf,
    shippingHuf,
    finalTotalHuf,
    invoiceMerchandiseHuf: merchandiseTotalHuf,
    invoiceShippingHuf: shippingHuf,
    invoiceTotalHuf: finalTotalHuf,
    freeShippingRemainingHuf,
    luckySpin: {
      ...luckySpinResult,
      active: applyLuckySpin,
      discountPercent: applyLuckySpin ? luckySpinResult.discountPercent : 0,
      discountHuf: luckySpinDiscountHuf,
    },
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
