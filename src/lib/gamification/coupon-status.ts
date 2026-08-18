export type GamificationCouponStatus = 'active' | 'used' | 'expired' | 'inactive'

export function gamificationCouponAdminStatus(
  row: {
    active: boolean
    usedCount: number
    maxUses: number | null
    validUntil: Date | string | null
  },
  now: Date = new Date()
): GamificationCouponStatus {
  const max = row.maxUses ?? 1
  if (row.usedCount >= max && max > 0) return 'used'
  const until = row.validUntil ? new Date(row.validUntil) : null
  if (until && !Number.isNaN(until.getTime()) && until.getTime() < now.getTime()) {
    return 'expired'
  }
  if (!row.active) return 'inactive'
  return 'active'
}
