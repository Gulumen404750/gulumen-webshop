import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import * as ProductLikes from '@/lib/product-likes'

const MAX_USER_ID_LENGTH = 128

function getUserIdFromRequest(request: Request): string | null {
  const id = request.headers.get('X-User-Id')?.trim()
  if (id && id.length > MAX_USER_ID_LENGTH) return null
  return id || null
}

/**
 * GET /api/me/wishlist – user kedvencei (privát), csak bejelentkezve.
 * Header: X-User-Id (kötelező; hiány → 401). userId max 128 karakter.
 * Rate limit: 60/perc/IP. Vissza: { productIds: string[] }.
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
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const productIds = ProductLikes.getLikedProductIdsByUser(userId)
    return NextResponse.json({ productIds })
  } catch (e) {
    console.error('[api/me/wishlist] GET', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
