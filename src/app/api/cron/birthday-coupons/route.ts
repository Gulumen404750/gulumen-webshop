import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { isDbConfigured } from '@/lib/prisma'
import { runBirthdayCouponJob } from '@/lib/birthday-coupon'

/**
 * GET /api/cron/birthday-coupons
 * Napi 1× (Vercel Cron / külső scheduler). CRON_SECRET Bearer.
 * Mai születésnapos, marketingOptIn felhasználóknak 15% kupon + e-mail.
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const result = await runBirthdayCouponJob()
    return NextResponse.json(result)
  } catch (e) {
    console.error('[api/cron/birthday-coupons]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Birthday coupon job failed' },
      { status: 500 }
    )
  }
}
