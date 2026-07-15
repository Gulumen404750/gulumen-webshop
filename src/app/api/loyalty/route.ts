import { NextResponse } from 'next/server'
import { getLoyaltyByEmail, getLoyaltyTier } from '@/lib/loyalty'

/** GET /api/loyalty?email=... – hűség százalék és szint az adott emailhez. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim()
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }
  const loyalty = getLoyaltyByEmail(email)
  const orderCount = loyalty?.qualifyingPaidOrdersCount ?? 0
  return NextResponse.json({
    loyaltyPercent: loyalty?.loyaltyPercent ?? 0,
    qualifyingPaidOrdersCount: orderCount,
    tier: getLoyaltyTier(orderCount),
  })
}
