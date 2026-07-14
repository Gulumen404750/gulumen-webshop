import { NextResponse } from 'next/server'
import { getProductByIdAsync } from '@/lib/data'
import { isDbConfigured } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import * as ProductLikes from '@/lib/product-likes'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { getLikeGamificationStatus } from '@/lib/gamification/like-gamification'

const MAX_ID_LENGTH = 128

function rejectIdTooLong(id: string, name: string): NextResponse | null {
  if (id.length > MAX_ID_LENGTH) {
    return NextResponse.json({ error: `Invalid ${name}` }, { status: 400 })
  }
  return null
}

function isLikeableType(type: string | undefined): boolean {
  return type === 'stock' || type === 'sourcing_deal'
}

/**
 * GET /api/products/[id]/like
 * Nyilvános: likesCount (mindenki ugyanaz).
 * Bejelentkezve: liked = az adott user kedveli-e.
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

    const product = await getProductByIdAsync(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (!isLikeableType(product.type)) {
      return NextResponse.json({ likesCount: 0, liked: false })
    }

    const likesCount = await ProductLikes.getLikesCount(productId)
    let liked = false
    let likeStatus: Awaited<ReturnType<typeof getLikeGamificationStatus>> | null = null
    try {
      const session = await getSession(request)
      if (session) {
        const userId = await resolveSessionUserId(session)
        if (userId) {
          liked = await ProductLikes.hasLike(productId, userId, session.email)
          if (isDbConfigured()) {
            likeStatus = await getLikeGamificationStatus(userId)
          } else {
            const { devGetLikeStatus } = await import('@/lib/dev-gamification')
            likeStatus = devGetLikeStatus(userId)
          }
        }
      }
    } catch {
      liked = false
    }

    return NextResponse.json({
      likesCount,
      liked,
      ...(likeStatus ?? {}),
    })
  } catch {
    return NextResponse.json({ likesCount: 0, liked: false })
  }
}

/**
 * POST /api/products/[id]/like – toggle like (csak bejelentkezve).
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

    const userId = await resolveSessionUserId(session)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found' },
        { status: 401 }
      )
    }

    const { id: productId } = await params
    if (!productId) {
      return NextResponse.json({ error: 'Missing product id' }, { status: 400 })
    }
    const idErr = rejectIdTooLong(productId, 'product id')
    if (idErr) return idErr

    const product = await getProductByIdAsync(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (!isLikeableType(product.type)) {
      return NextResponse.json(
        { error: 'Likes only for stock and sourcing_deal products' },
        { status: 400 }
      )
    }

    const result = await ProductLikes.toggleLike(productId, userId, session.email)

    if (result.dailyBonusQueued) {
      const { processPendingPointEvents } = await import('@/lib/gamification/point-event-queue')
      await processPendingPointEvents(5, userId)
    } else if (isDbConfigured()) {
      const { processPendingPointEvents } = await import('@/lib/gamification/point-event-queue')
      await processPendingPointEvents(3, userId)
    }

    return NextResponse.json({
      likesCount: result.likesCount,
      liked: result.liked,
      qualifyingLikeCount: result.qualifyingLikeCount,
      qualifyingLikeTarget: result.qualifyingLikeTarget,
      pointLimitReached: result.pointLimitReached,
      canEarnLikeProgress: result.canEarnLikeProgress,
      windowResetsAt: result.windowResetsAt,
      dailyLikeCount: result.dailyLikeCount,
      dailyLikeTarget: result.dailyLikeTarget,
    })
  } catch (e) {
    console.error('[api/products/[id]/like] POST', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
