import { NextResponse } from 'next/server'
import { getProductById } from '@/lib/data'
import { rateLimit } from '@/lib/rate-limit'
import * as ProductLikes from '@/lib/product-likes'
import { getSession } from '@/lib/auth'

const MAX_ID_LENGTH = 128

function rejectIdTooLong(id: string, name: string): NextResponse | null {
  if (id.length > MAX_ID_LENGTH) {
    return NextResponse.json({ error: `Invalid ${name}` }, { status: 400 })
  }
  return null
}

/**
 * GET /api/products/[id]/like
 * Nyilvános: likesCount (mindenki ugyanaz).
 * Ha van X-User-Id: liked = az adott user kedveli-e (privát).
 * Rate limit: 60 kérés / perc / IP.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limit = rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429 }
    )
  }
  try {
    const { id: productId } = await params
    if (!productId) {
      return NextResponse.json({ error: 'Missing product id' }, { status: 400 })
    }
    const idErr = rejectIdTooLong(productId, 'product id')
    if (idErr) return idErr

    const product = getProductById(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const type = product.type ?? 'stock'
    if (type !== 'stock' && type !== 'sourcing_deal') {
      return NextResponse.json({
        likesCount: 0,
        liked: false,
      })
    }

    const likesCount = ProductLikes.getLikesCount(productId)
    let liked = false
    try {
      const session = await getSession(request)
      liked = session ? ProductLikes.hasLike(productId, session.userId) : false
    } catch {
      liked = false
    }

    return NextResponse.json({ likesCount, liked })
  } catch {
    return NextResponse.json({ likesCount: 0, liked: false })
  }
}

/**
 * POST /api/products/[id]/like – toggle like (csak bejelentkezve, session alapján).
 * Vissza: { likesCount, liked }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limit = rateLimit(request)
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Túl sok kérés. Próbáld újra később.' },
        { status: 429 }
      )
    }

    const session = await getSession(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Login required to like' },
        { status: 401 }
      )
    }

    const { id: productId } = await params
    if (!productId) {
      return NextResponse.json({ error: 'Missing product id' }, { status: 400 })
    }
    const idErr = rejectIdTooLong(productId, 'product id')
    if (idErr) return idErr

    const product = getProductById(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const type = product.type ?? 'stock'
    if (type !== 'stock' && type !== 'sourcing_deal') {
      return NextResponse.json(
        { error: 'Likes only for stock and sourcing_deal products' },
        { status: 400 }
      )
    }

    const { liked, likesCount } = ProductLikes.toggleLike(productId, session.userId)

    return NextResponse.json({ likesCount, liked })
  } catch (e) {
    console.error('[api/products/[id]/like] POST', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
