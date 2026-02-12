import { NextResponse } from 'next/server'
import { getLoyaltyByEmail } from '@/lib/loyalty'

/** GET /api/loyalty?email=... – hűség százalék az adott emailhez (checkout megjelenítéshez). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim()
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }
  const loyalty = getLoyaltyByEmail(email)
  return NextResponse.json({
    loyaltyPercent: loyalty?.loyaltyPercent ?? 0,
  })
}
