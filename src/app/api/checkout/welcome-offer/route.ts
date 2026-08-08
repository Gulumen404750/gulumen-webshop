import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import {
  acceptWelcomeCheckoutOffer,
  getWelcomeOfferEligibility,
} from '@/lib/welcome-checkout-offer'

const postSchema = z.object({
  email: z.string().email(),
})

/**
 * GET /api/checkout/welcome-offer?email=
 * Elérhető-e a 10% + hírlevél checkout ajánlat.
 */
export async function GET(request: Request) {
  const limit = rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés.' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  let email = searchParams.get('email')?.trim() ?? ''

  // Bejelentkezett user: session e-mail elsőbbség
  const session = await getSession(request)
  if (session?.email) {
    email = session.email
  }

  if (!email) {
    return NextResponse.json({
      eligible: false,
      reason: 'invalid_email',
      percent: 0.1,
    })
  }

  const result = await getWelcomeOfferEligibility(email)
  return NextResponse.json(result)
}

/**
 * POST /api/checkout/welcome-offer
 * Azonnali elfogadás: marketingOptIn + hasRedeemedWelcomeCoupon.
 */
export async function POST(request: Request) {
  const limit = rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvényes e-mail szükséges.' }, { status: 400 })
  }

  let email = parsed.data.email.trim().toLowerCase()
  let userId: string | null = null

  const session = await getSession(request)
  if (session) {
    userId = await resolveSessionUserId(session)
    if (session.email) email = session.email.trim().toLowerCase()
  }

  const result = await acceptWelcomeCheckoutOffer({ email, userId })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    percent: result.percent,
    alreadyAccepted: result.alreadyAccepted ?? false,
    marketingOptIn: true,
    hasRedeemedWelcomeCoupon: true,
  })
}
