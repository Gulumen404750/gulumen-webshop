import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import * as ProductLikes from '@/lib/product-likes'
import { getDismissedProductIdsByUser } from '@/lib/product-dismiss'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { isDbConfigured } from '@/lib/prisma'
import { getProductsByIdsFromDb } from '@/lib/products'
import { getProductByIdAsync } from '@/lib/data'
import type { Product } from '@/lib/data'

/**
 * GET /api/me/wishlist – user kedvencei (privát), session alapján.
 * Visszaadja a productIds-t és a teljes termékobjektumokat (katalógus-szűrés nélkül).
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

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [productIds, dismissedIds] = await Promise.all([
      ProductLikes.getLikedProductIdsByUser(userId, session.email),
      getDismissedProductIdsByUser(userId),
    ])

    let products: Product[] = []
    if (isDbConfigured()) {
      products = await getProductsByIdsFromDb(productIds)
    } else {
      for (const id of productIds) {
        const product = await getProductByIdAsync(id)
        if (product) products.push(product)
      }
    }

    return NextResponse.json({ productIds, products, dismissedIds })
  } catch (e) {
    console.error('[api/me/wishlist] GET', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
