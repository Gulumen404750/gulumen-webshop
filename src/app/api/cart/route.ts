import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

/**
 * GET /api/cart
 * Kijelentkezett felhasználónak mindig üres kosár – korábbi session adat nem adható vissza.
 * (A kosár kliens oldali localStorage-ban él; szerveren nincs perzisztált kosár.)
 */
export async function GET(request: Request) {
  const session = await getSession(request)
  if (!session?.email && !session?.userId) {
    return NextResponse.json({ items: [] }, { status: 200 })
  }

  return NextResponse.json({ items: [] })
}
