import {
  GIFT_POINTS_MAX_COVERAGE,
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
} from './constants'
import { getPointBalance } from './point-ledger'
import { getAvailableGiftPoints } from './gift-points'

export function hufToPoints(huf: number): number {
  return Math.max(0, Math.floor(huf * POINTS_PER_HUF))
}

export function pointsToHuf(points: number): number {
  return Math.max(0, Math.floor(points / POINTS_PER_HUF))
}

export function maxPointsDiscountHuf(
  cartTotalHuf: number,
  coverage = MAX_CART_POINTS_COVERAGE
): number {
  return Math.max(0, Math.floor(cartTotalHuf * coverage))
}

export type PurchasePointsValidation = {
  ok: true
  pointsDiscountHuf: number
  pointsUsed: number
  cardTotalHuf: number
  giftPointsUsed: number
} | {
  ok: false
  error: string
}

export type PointsRedemptionBreakdown = {
  pointsDiscountHuf: number
  pointsUsed: number
  giftPointsUsed: number
}

function roundSpend(n: number): number {
  return Math.max(0, Math.floor(n))
}

/**
 * Pontbeváltás: NFC/ajándékpont a termékár 100%-áig, sima pont max. 30%.
 * A szállítási díjat soha nem fedezi.
 */
export function computeMixedPointsRedemption(input: {
  merchandiseHuf: number
  requestedDiscountHuf: number
  userBalance: number
  giftPointsAvailable: number
}): PointsRedemptionBreakdown {
  const merchandiseHuf = roundSpend(input.merchandiseHuf)
  if (merchandiseHuf <= 0 || input.requestedDiscountHuf <= 0) {
    return { pointsDiscountHuf: 0, pointsUsed: 0, giftPointsUsed: 0 }
  }

  const giftAvailable = Math.min(
    roundSpend(input.giftPointsAvailable),
    roundSpend(input.userBalance)
  )
  const regularAvailable = Math.max(0, roundSpend(input.userBalance) - giftAvailable)

  const giftCapHuf = maxPointsDiscountHuf(merchandiseHuf, GIFT_POINTS_MAX_COVERAGE)
  const giftUseHuf = Math.min(
    roundSpend(input.requestedDiscountHuf),
    giftCapHuf,
    pointsToHuf(giftAvailable),
    merchandiseHuf
  )
  const leftoverMerch = merchandiseHuf - giftUseHuf
  const leftoverRequested = roundSpend(input.requestedDiscountHuf) - giftUseHuf
  const regularCapHuf = maxPointsDiscountHuf(leftoverMerch, MAX_CART_POINTS_COVERAGE)
  const regularUseHuf = Math.min(
    leftoverRequested,
    regularCapHuf,
    leftoverMerch,
    pointsToHuf(regularAvailable)
  )

  const pointsDiscountHuf = giftUseHuf + regularUseHuf
  const pointsUsed = hufToPoints(pointsDiscountHuf)
  if (pointsUsed <= 0) {
    return { pointsDiscountHuf: 0, pointsUsed: 0, giftPointsUsed: 0 }
  }
  return {
    pointsDiscountHuf,
    pointsUsed,
    giftPointsUsed: hufToPoints(giftUseHuf),
  }
}

/** Szerveroldali validáció – kliens csak kérést küld, a delta itt számolódik. */
export async function validatePurchasePoints(
  userId: string,
  cartTotalHuf: number,
  requestedPointsDiscountHuf: number
): Promise<PurchasePointsValidation> {
  if (cartTotalHuf <= 0) {
    return { ok: false, error: 'Invalid cart total' }
  }
  if (requestedPointsDiscountHuf <= 0) {
    return {
      ok: true,
      pointsDiscountHuf: 0,
      pointsUsed: 0,
      cardTotalHuf: cartTotalHuf,
      giftPointsUsed: 0,
    }
  }

  const [balance, giftPointsAvailable] = await Promise.all([
    getPointBalance(userId),
    getAvailableGiftPoints(userId),
  ])
  const redemption = computeMixedPointsRedemption({
    merchandiseHuf: cartTotalHuf,
    requestedDiscountHuf: requestedPointsDiscountHuf,
    userBalance: balance,
    giftPointsAvailable,
  })

  if (redemption.pointsUsed <= 0) {
    return {
      ok: true,
      pointsDiscountHuf: 0,
      pointsUsed: 0,
      cardTotalHuf: cartTotalHuf,
      giftPointsUsed: 0,
    }
  }

  if (balance < redemption.pointsUsed) {
    return { ok: false, error: 'Insufficient points' }
  }

  return {
    ok: true,
    pointsDiscountHuf: redemption.pointsDiscountHuf,
    pointsUsed: redemption.pointsUsed,
    cardTotalHuf: cartTotalHuf - redemption.pointsDiscountHuf,
    giftPointsUsed: redemption.giftPointsUsed,
  }
}

/** Kosár két rendelésre osztott pontkedvezmény (in_stock + sourcing). */
export function splitPointsDiscount(
  totalPointsDiscountHuf: number,
  inStockTotal: number,
  sourcingTotal: number
): { inStock: number; sourcing: number } {
  if (totalPointsDiscountHuf <= 0) {
    return { inStock: 0, sourcing: 0 }
  }
  const combined = inStockTotal + sourcingTotal
  if (combined <= 0) return { inStock: 0, sourcing: 0 }
  const inStock = Math.floor((totalPointsDiscountHuf * inStockTotal) / combined)
  const sourcing = totalPointsDiscountHuf - inStock
  return { inStock, sourcing }
}

export function splitPointsUsed(
  totalPointsUsed: number,
  inStockDiscountHuf: number,
  sourcingDiscountHuf: number
): { inStock: number; sourcing: number } {
  if (totalPointsUsed <= 0) return { inStock: 0, sourcing: 0 }
  const totalHuf = inStockDiscountHuf + sourcingDiscountHuf
  if (totalHuf <= 0) return { inStock: 0, sourcing: 0 }
  const inStock = Math.floor((totalPointsUsed * inStockDiscountHuf) / totalHuf)
  return { inStock, sourcing: totalPointsUsed - inStock }
}
