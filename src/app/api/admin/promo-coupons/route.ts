import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { listAdminPromoCouponUsers } from '@/lib/promo-coupons'
import { isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/admin/promo-coupons
 * Regisztrált felhasználók macska (5%) és regisztrációs (10%) kupon állapota.
 */
export async function GET() {
  const gate = await requireAdminPermission('coupons:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ users: [], message: 'Database not configured' })
  }

  try {
    const users = await listAdminPromoCouponUsers(500)
    const withAnyCoupon = users.filter(
      (u) => u.catStatus != null || u.registrationStatus != null
    )
    return NextResponse.json({
      users,
      totalUsers: users.length,
      withCouponCount: withAnyCoupon.length,
    })
  } catch (e) {
    console.error('[api/admin/promo-coupons] GET', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
