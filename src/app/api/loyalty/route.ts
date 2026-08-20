import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLoyaltyByEmail, getLoyaltyTier, LOYALTY_THRESHOLD_HUF, LOYALTY_MAX_PERCENT } from '@/lib/loyalty'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

/**
 * GET /api/loyalty?email=...
 * Bejelentkezve a session e-mailje az irányadó. Vendég checkout: ?email= a számlázási cím.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const session = await getSession(request)
  const queryEmail = searchParams.get('email')?.trim().toLowerCase() || ''
  const email = (session?.email || queryEmail).trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400, headers: NO_STORE })
  }

  const loyalty = await getLoyaltyByEmail(email)
  const orderCount = loyalty?.qualifyingPaidOrdersCount ?? 0
  const loyaltyPercent = loyalty?.loyaltyPercent ?? 0
  return NextResponse.json(
    {
      loyaltyPercent,
      qualifyingPaidOrdersCount: orderCount,
      tier: getLoyaltyTier(loyaltyPercent),
      thresholdHuf: LOYALTY_THRESHOLD_HUF,
      maxPercent: LOYALTY_MAX_PERCENT,
    },
    { headers: NO_STORE }
  )
}
