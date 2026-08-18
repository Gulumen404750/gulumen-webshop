import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import {
  claimGiftPointCode,
  previewGiftPointCode,
  normalizeGiftPointToken,
} from '@/lib/gamification/gift-point-codes'
import { GIFT_POINT_VALIDITY_DAYS } from '@/lib/gamification/constants'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

const claimSchema = z.object({
  token: z.string().min(4).max(64),
})

function mapClaimError(reason: string): { status: number; code: string; error: string } {
  switch (reason) {
    case 'not_found':
      return { status: 404, code: 'gift_code_invalid', error: 'Ismeretlen ajándékpont-kód.' }
    case 'already_used':
      return { status: 409, code: 'gift_code_used', error: 'Ez a kód már fel lett használva.' }
    case 'inactive':
      return { status: 400, code: 'gift_code_inactive', error: 'Ez a kód nem aktív.' }
    case 'expired':
      return { status: 400, code: 'gift_code_expired', error: 'A kód érvényességi ideje lejárt.' }
    case 'not_yet_valid':
      return { status: 400, code: 'gift_code_not_yet_valid', error: 'A kód még nem váltható be.' }
    case 'db_unavailable':
      return { status: 503, code: 'db_unavailable', error: 'Az adatbázis nem elérhető.' }
    default:
      return { status: 400, code: 'gift_code_failed', error: 'Az aktiválás sikertelen.' }
  }
}

/**
 * GET /api/gift-points/claim?token=
 * Előnézet bejelentkezés nélkül (pontérték + státusz).
 */
export async function GET(request: Request) {
  const limit = await rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés.' }, { status: 429, headers: NO_STORE })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503, headers: NO_STORE })
  }

  const url = new URL(request.url)
  const token = normalizeGiftPointToken(url.searchParams.get('token') ?? '')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400, headers: NO_STORE })
  }

  const preview = await previewGiftPointCode(token)
  return NextResponse.json(
    {
      status: preview.status,
      points: preview.status === 'not_found' ? null : preview.points,
      validityDays: GIFT_POINT_VALIDITY_DAYS,
    },
    { headers: NO_STORE }
  )
}

/**
 * POST /api/gift-points/claim
 * Bejelentkezett user: egyszer használatos aktiválás, pontok a tárcába, 1 hónap.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, { preset: 'auth' })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés.' }, { status: 429, headers: NO_STORE })
  }

  const session = await getSession(request)
  if (!session) {
    return NextResponse.json(
      { error: 'Bejelentkezés szükséges.', code: 'login_required' },
      { status: 401, headers: NO_STORE }
    )
  }
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json(
      { error: 'Bejelentkezés szükséges.', code: 'login_required' },
      { status: 401, headers: NO_STORE }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE })
  }
  const parsed = claimSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvénytelen kód.' }, { status: 400, headers: NO_STORE })
  }

  const result = await claimGiftPointCode({ token: parsed.data.token, userId })
  if (!result.ok) {
    const mapped = mapClaimError(result.reason)
    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status, headers: NO_STORE }
    )
  }

  return NextResponse.json(
    {
      ok: true,
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
