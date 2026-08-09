import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import {
  claimUserPromoCoupon,
  getUserPromoCouponState,
  markUserPromoCouponsUsed,
  type PromoCouponKind,
} from '@/lib/promo-coupons'
import { isDbConfigured } from '@/lib/prisma'
import { CAT_COUPON_PERCENT, REGISTRATION_COUPON_PERCENT } from '@/lib/coupon-config'

const claimSchema = z.object({
  kind: z.enum(['cat', 'registration']),
})

/** GET /api/me/promo-coupons – bejelentkezett user promo kupon állapota. */
export async function GET(request: Request) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = await resolveSessionUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDbConfigured()) {
    return NextResponse.json({
      cat: null,
      registration: null,
      discountPercent: 0,
    })
  }

  const state = await getUserPromoCouponState(userId)
  let discountPercent = 0
  if (state.cat === 'claimed') discountPercent += CAT_COUPON_PERCENT
  if (state.registration === 'claimed') discountPercent += REGISTRATION_COUPON_PERCENT

  return NextResponse.json({
    ...state,
    discountPercent,
  })
}

/** POST /api/me/promo-coupons – kupon aktiválás (cat | registration). */
export async function POST(request: Request) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = await resolveSessionUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = claimSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const kind = parsed.data.kind as PromoCouponKind
  const result = await claimUserPromoCoupon(userId, kind)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason, ok: false }, { status: 409 })
  }

  const state = await getUserPromoCouponState(userId)
  return NextResponse.json({ ok: true, ...state })
}

/** PATCH /api/me/promo-coupons – claimed kuponok felhasználttá (vásárlás után). */
export async function PATCH(request: Request) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = await resolveSessionUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await markUserPromoCouponsUsed(userId)
  const state = await getUserPromoCouponState(userId)
  return NextResponse.json({ ok: true, ...state })
}
