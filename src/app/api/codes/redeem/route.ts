import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import { lookupRedeemableCode } from '@/lib/redeem-code'
import { claimCouponForUser } from '@/lib/coupon-claim'
import { claimGiftPointCode } from '@/lib/gamification/gift-point-codes'
import { GIFT_POINT_VALIDITY_DAYS } from '@/lib/gamification/constants'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

const bodySchema = z.object({
  code: z.string().min(1).max(64).optional(),
  token: z.string().min(1).max(64).optional(),
})

function mapGiftError(reason: string): { status: number; code: string; error: string } {
  switch (reason) {
    case 'not_found':
      return { status: 404, code: 'gift_code_invalid', error: 'Unknown code.' }
    case 'already_used':
      return { status: 409, code: 'gift_code_used', error: 'This code has already been used.' }
    case 'inactive':
      return { status: 400, code: 'gift_code_inactive', error: 'This code is not active.' }
    case 'expired':
      return { status: 400, code: 'gift_code_expired', error: 'This code has expired.' }
    case 'not_yet_valid':
      return { status: 400, code: 'gift_code_not_yet_valid', error: 'This code cannot be claimed yet.' }
    case 'db_unavailable':
      return { status: 503, code: 'db_unavailable', error: 'Database unavailable.' }
    default:
      return { status: 400, code: 'gift_code_failed', error: 'Activation failed.' }
  }
}

function mapCouponError(code: string, fallback: string): { status: number; code: string; error: string } {
  const error = fallback || 'Invalid coupon code.'
  switch (code) {
    case 'coupon_inactive':
      return { status: 400, code, error }
    case 'coupon_expired':
      return { status: 400, code, error }
    case 'coupon_exhausted':
    case 'coupon_already_claimed':
    case 'coupon_used':
      return { status: 409, code, error }
    case 'coupon_login_required':
      return { status: 401, code, error }
    case 'coupon_not_owned':
      return { status: 403, code, error }
    case 'coupon_unavailable':
      return { status: 503, code, error }
    default:
      return { status: 400, code, error }
  }
}

/**
 * POST /api/codes/redeem
 * Kuponkód vagy ajándékpont-kód / tételcímke beváltása.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, { preset: 'auth' })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: NO_STORE })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database unavailable.', code: 'db_unavailable' }, { status: 503, headers: NO_STORE })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid code.', code: 'code_invalid' }, { status: 400, headers: NO_STORE })
  }
  const raw = (parsed.data.code ?? parsed.data.token ?? '').trim()
  if (!raw) {
    return NextResponse.json({ error: 'Enter the code.', code: 'code_required' }, { status: 400, headers: NO_STORE })
  }

  const session = await getSession(request)
  const userId = session ? await resolveSessionUserId(session) : null

  const looked = await lookupRedeemableCode(raw, userId)

  if (looked.kind === 'coupon_error') {
    const mapped = mapCouponError(looked.code, looked.error)
    return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status, headers: NO_STORE })
  }

  if (looked.kind === 'coupon') {
    const claimed = await claimCouponForUser({
      userId,
      code: looked.coupon.code,
      allowExistingUnused: false,
    })
    if (!claimed.ok) {
      const mapped = mapCouponError(claimed.code, claimed.error)
      return NextResponse.json(
        { error: mapped.error, code: mapped.code },
        { status: mapped.status, headers: NO_STORE }
      )
    }
    const c = claimed.coupon
    return NextResponse.json(
      {
        ok: true,
        kind: 'coupon',
        code: c.code,
        checkoutCode: c.checkoutCode,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderHuf: c.minOrderHuf,
        validUntil: c.validUntil ? c.validUntil.toISOString() : null,
        source: c.source,
        created: claimed.created,
      },
      { headers: NO_STORE }
    )
  }

  if (looked.kind === 'gift_points') {
    if (!userId) {
      return NextResponse.json(
        { error: 'Log in to redeem.', code: 'login_required' },
        { status: 401, headers: NO_STORE }
      )
    }
    const result = await claimGiftPointCode({ token: looked.token, userId })
    if (!result.ok) {
      const mapped = mapGiftError(result.reason)
      return NextResponse.json(
        { error: mapped.error, code: mapped.code },
        { status: mapped.status, headers: NO_STORE }
      )
    }
    return NextResponse.json(
      {
        ok: true,
        kind: 'gift_points',
        alreadyClaimedByYou: result.alreadyClaimedByYou === true,
        points: result.points,
        grantId: result.grantId,
        expiresAt: result.expiresAt.toISOString(),
        balanceAfter: result.balanceAfter,
        validityDays: GIFT_POINT_VALIDITY_DAYS,
        token: result.token,
      },
      { headers: NO_STORE }
    )
  }

  return NextResponse.json(
    { error: 'Unknown coupon or gift-point code.', code: 'code_invalid' },
    { status: 404, headers: NO_STORE }
  )
}
