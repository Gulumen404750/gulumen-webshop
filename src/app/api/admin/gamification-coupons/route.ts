import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import {
  listAdminGamificationCoupons,
  summarizeGamificationCouponStats,
} from '@/lib/gamification/admin-coupons'

/**
 * GET /api/admin/gamification-coupons
 * Pontból váltott 10%-os kuponok (Coupon.source = gamification) felhasználóval.
 */
export async function GET() {
  const gate = await requireAdminPermission('coupons:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ coupons: [], stats: { total: 0, active: 0, used: 0, expired: 0, inactive: 0 } })
  }

  try {
    const coupons = await listAdminGamificationCoupons(500)
    return NextResponse.json({
      coupons,
      stats: summarizeGamificationCouponStats(coupons),
    })
  } catch (e) {
    console.error('[api/admin/gamification-coupons] GET', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
