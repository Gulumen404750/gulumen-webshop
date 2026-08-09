import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import * as ProductLikes from '@/lib/product-likes'
import { getSession } from '@/lib/auth'

/**
 * GET /api/me/wishlist – user kedvencei (privát), session alapján.
 * Rate limit: 60/perc/IP. Vissza: { productIds: string[] }.
 */
export async function GET(request: Request) {
  const limit = await rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429 }
    )
  }
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const productIds = ProductLikes.getLikedProductIdsByUser(session.userId)
    return NextResponse.json({ productIds })
  } catch (e) {
    console.error('[api/me/wishlist] GET', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
