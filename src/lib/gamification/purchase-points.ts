import {
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
} from './constants'
import { getPointBalance } from './point-ledger'

export function hufToPoints(huf: number): number {
  return Math.max(0, Math.floor(huf * POINTS_PER_HUF))
}

export function pointsToHuf(points: number): number {
  return Math.max(0, Math.floor(points / POINTS_PER_HUF))
}

export function maxPointsDiscountHuf(cartTotalHuf: number): number {
  return Math.max(0, Math.floor(cartTotalHuf * MAX_CART_POINTS_COVERAGE))
}

export type PurchasePointsValidation = {
  ok: true
  pointsDiscountHuf: number
  pointsUsed: number
  cardTotalHuf: number
} | {
  ok: false
  error: string
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
    }
  }

  const maxHuf = maxPointsDiscountHuf(cartTotalHuf)
  const pointsDiscountHuf = Math.min(Math.floor(requestedPointsDiscountHuf), maxHuf, cartTotalHuf)
  const pointsUsed = hufToPoints(pointsDiscountHuf)

  if (pointsUsed <= 0) {
    return {
      ok: true,
      pointsDiscountHuf: 0,
      pointsUsed: 0,
      cardTotalHuf: cartTotalHuf,
    }
  }

  const balance = await getPointBalance(userId)
  if (balance < pointsUsed) {
    return { ok: false, error: 'Insufficient points' }
  }

  return {
    ok: true,
    pointsDiscountHuf,
    pointsUsed,
    cardTotalHuf: cartTotalHuf - pointsDiscountHuf,
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
