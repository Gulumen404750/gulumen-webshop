/**
 * Felhasználó saját, pontból váltott (gamification) kuponjai.
 */
import { gamificationCouponAdminStatus } from './coupon-status'

export type UserGamificationCouponStatus = 'active' | 'used' | 'expired' | 'inactive'

export type UserGamificationCoupon = {
  id: string
  code: string
  checkoutCode: string
  discountPercent: number
  discountType: 'percent' | 'fixed'
  discountValue: number
  status: UserGamificationCouponStatus
  usedCount: number
  maxUses: number | null
  createdAt: string
  validUntil: string | null
}

export type UserCouponRowInput = {
  id: string
  code: string
  claimedFromCode?: string | null
  discountType: string
  discountValue: number
  active: boolean
  usedCount: number
  maxUses: number | null
  createdAt: Date | string
  validUntil: Date | string | null
}

export function discountPercentFromCoupon(discountType: string, discountValue: number): number {
  if (discountType === 'percent' && discountValue > 0) {
    return discountValue > 1 ? discountValue : Math.round(discountValue * 100)
  }
  return 0
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function mapUserGamificationCoupon(
  row: UserCouponRowInput,
  now: Date = new Date()
): UserGamificationCoupon {
  const displayCode = (row.claimedFromCode || row.code).toUpperCase()
  return {
    id: row.id,
    code: displayCode,
    checkoutCode: row.code,
    discountPercent: discountPercentFromCoupon(row.discountType, row.discountValue),
    discountType: row.discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: row.discountValue,
    status: gamificationCouponAdminStatus(row, now),
    usedCount: row.usedCount,
    maxUses: row.maxUses,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    validUntil: toIso(row.validUntil),
  }
}

const STATUS_ORDER: Record<UserGamificationCouponStatus, number> = {
  active: 0,
  inactive: 1,
  expired: 2,
  used: 3,
}

export function sortUserGamificationCoupons(
  rows: UserGamificationCoupon[]
): UserGamificationCoupon[] {
  return [...rows].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (byStatus !== 0) return byStatus
    return b.createdAt.localeCompare(a.createdAt)
  })
}

/** Van-e elég pont egy új 10%-os kuponra (meglévő kupon nem tiltja). */
export function canRedeemFromBalance(
  balance: number,
  threshold: number,
  suspended = false
): boolean {
  return (
    Number.isFinite(balance) &&
    Number.isFinite(threshold) &&
    threshold > 0 &&
    balance >= threshold &&
    !suspended
  )
}

/** Hány darab 10%-os kupon váltható a jelenlegi egyenlegből. */
export function redeemableCouponCount(
  balance: number,
  threshold: number,
  suspended = false
): number {
  if (!canRedeemFromBalance(balance, threshold, suspended)) return 0
  return Math.floor(balance / threshold)
}

/** Aktív, még fel nem használt pontkuponok a fizetéshez. */
export function listActiveCheckoutCoupons<T extends { status: string }>(
  coupons: T[]
): T[] {
  return coupons.filter((c) => c.status === 'active')
}

export function pickActiveCheckoutCoupon<T extends { status: string }>(
  coupons: T[]
): T | null {
  return listActiveCheckoutCoupons(coupons)[0] ?? null
}
