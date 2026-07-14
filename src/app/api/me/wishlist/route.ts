import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import * as ProductLikes from '@/lib/product-likes'
import { getProductByIdAsync } from '@/lib/data'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import type { Product } from '@/lib/data'

/**
 * GET /api/me/wishlist – user kedvencei (privát), session alapján.
 * Visszaadja a productIds-t és a teljes termékobjektumokat (katalógus-szűrés nélkül).
 */
export async function GET(request: Request) {
  const limit = rateLimit(request)
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

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const productIds = await ProductLikes.getLikedProductIdsByUser(userId, session.email)
    const products: Product[] = []
    for (const id of productIds) {
      const product = await getProductByIdAsync(id)
      if (product) products.push(product)
    }

    return NextResponse.json({ productIds, products })
  } catch (e) {
    console.error('[api/me/wishlist] GET', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
