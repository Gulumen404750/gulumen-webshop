import { orderUsedInternalPoints } from '@/lib/order-points-accounting'
import { isInstallmentPayment } from '@/lib/checkout-payment-methods'
import {
  GIFT_POINTS_MAX_COVERAGE,
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
  PURCHASE_EARN_HUF_PER_POINT,
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

/** Sikeres tiszta kártyás/készpénzes fizetés: 100 Ft = 1 pont. */
export function cashPaidHufToEarnPoints(paidHuf: number): number {
  if (!Number.isFinite(paidHuf) || paidHuf < PURCHASE_EARN_HUF_PER_POINT) return 0
  return Math.floor(paidHuf / PURCHASE_EARN_HUF_PER_POINT)
}

/**
 * Vásárlási pontjóváírás: csak tiszta kártya / PayPal / mobiltárca.
 * Pontfizetés vagy külső részletfizetés (Klarna) után extra pont nem jár.
 */
export function purchaseEarnPointsForOrder(order: {
  userId?: string | null
  totalHuf?: number | null
  paidHuf?: number | null
  pointsUsed?: number | null
  pointsDiscountHuf?: number | null
  giftPointsUsed?: number | null
  paymentMethod?: string | null
}): number {
  if (!order.userId) return 0
  if (orderUsedInternalPoints(order)) return 0
  if (isInstallmentPayment(order.paymentMethod)) return 0
  const paidHuf = order.paidHuf ?? order.totalHuf ?? 0
  return cashPaidHufToEarnPoints(paidHuf)
}

export type PurchasePointsValidation = {
  ok: true
  pointsDiscountHuf: number
  pointsUsed: number
  cardTotalHuf: number
  giftPointsUsed: number
  activityPointsUsed: number
} | {
  ok: false
  error: string
}

export type PointsRedemptionBreakdown = {
  pointsDiscountHuf: number
  pointsUsed: number
  giftPointsUsed: number
  activityPointsUsed: number
}

export type WalletBalanceSplit = {
  giftBalance: number
  activityBalance: number
}

function roundSpend(n: number): number {
  return Math.max(0, Math.floor(n))
}

const ZERO_REDEMPTION: PointsRedemptionBreakdown = {
  pointsDiscountHuf: 0,
  pointsUsed: 0,
  giftPointsUsed: 0,
  activityPointsUsed: 0,
}

/** A teljes tárcaegyenlegből az ajándék maradék a gift grant, a többi aktivitási pont. */
export function splitWalletBalances(
  totalBalance: number,
  giftPointsAvailable: number
): WalletBalanceSplit {
  const total = roundSpend(totalBalance)
  const giftBalance = Math.min(total, roundSpend(giftPointsAvailable))
  return {
    giftBalance,
    activityBalance: Math.max(0, total - giftBalance),
  }
}

/**
 * Pontbeváltás: NFC/ajándék- és aktivitási pont 1:1 a termékár 100%-áig.
 * A szállítási díjat soha nem fedezi. spendGift / spendActivity: melyik tárcát költi a vevő.
 */
export function computeMixedPointsRedemption(input: {
  merchandiseHuf: number
  requestedDiscountHuf: number
  userBalance: number
  giftPointsAvailable: number
  spendGift?: boolean
  spendActivity?: boolean
}): PointsRedemptionBreakdown {
  const merchandiseHuf = roundSpend(input.merchandiseHuf)
  const spendGift = input.spendGift !== false
  const spendActivity = input.spendActivity !== false
  if (merchandiseHuf <= 0 || input.requestedDiscountHuf <= 0 || (!spendGift && !spendActivity)) {
    return { ...ZERO_REDEMPTION }
  }

  const { giftBalance, activityBalance } = splitWalletBalances(
    input.userBalance,
    input.giftPointsAvailable
  )
  const giftAvailable = spendGift ? giftBalance : 0
  const regularAvailable = spendActivity ? activityBalance : 0

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
  const giftPointsUsed = hufToPoints(giftUseHuf)
  const activityPointsUsed = hufToPoints(regularUseHuf)
  const pointsUsed = giftPointsUsed + activityPointsUsed
  if (pointsUsed <= 0) {
    return { ...ZERO_REDEMPTION }
  }
  return {
    pointsDiscountHuf,
    pointsUsed,
    giftPointsUsed,
    activityPointsUsed,
  }
}

/** Szerveroldali validáció – kliens csak kérést küld, a delta itt számolódik. */
export async function validatePurchasePoints(
  userId: string,
  cartTotalHuf: number,
  requestedPointsDiscountHuf: number,
  options?: { spendGift?: boolean; spendActivity?: boolean }
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
      activityPointsUsed: 0,
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
    spendGift: options?.spendGift,
    spendActivity: options?.spendActivity,
  })

  if (redemption.pointsUsed <= 0) {
    return {
      ok: true,
      pointsDiscountHuf: 0,
      pointsUsed: 0,
      cardTotalHuf: cartTotalHuf,
      giftPointsUsed: 0,
      activityPointsUsed: 0,
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
    activityPointsUsed: redemption.activityPointsUsed,
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
