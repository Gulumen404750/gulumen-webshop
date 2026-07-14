import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import { generateLuckySpin, getLuckySpinStatus } from '@/lib/gamification/lucky-spin'
import { getProductByIdAsync } from '@/lib/data'

type StatusLike = {
  spin: {
    id: string
    weekId: string
    productIds: string[]
    generatedAt: Date
    expiresAt: Date
  } | null
  canSpin: boolean
  nextSpinAt: string | null
  isActive: boolean
  isExpired?: boolean
  likesCount?: number
  isEligible?: boolean
}

async function enrichSpinResponse(status: StatusLike, extra?: { created?: boolean }) {
  const products = status.spin
    ? await Promise.all(
        status.spin.productIds.map(async (id) => {
          const p = await getProductByIdAsync(id)
          if (!p) return null
          return {
            id: p.id,
            slug: p.slug,
            name: p.name,
            image: p.image,
            priceHuf: p.priceHuf,
            discountPriceHuf: p.discountPriceHuf,
          }
        })
      )
    : []

  const spinPayload = status.spin
    ? {
        id: status.spin.id,
        weekId: status.spin.weekId,
        productIds: status.spin.productIds,
        generatedAt: status.spin.generatedAt.toISOString(),
        expiresAt: status.spin.expiresAt.toISOString(),
        products: products.filter(Boolean),
      }
    : null

  return {
    spin: spinPayload,
    /** Alias a kliens számára – a 10 kiválasztott termék azonosítói. */
    spinResult: spinPayload
      ? {
          productIds: spinPayload.productIds,
          products: spinPayload.products,
          expiresAt: spinPayload.expiresAt,
        }
      : null,
    canSpin: status.canSpin,
    nextSpinAt: status.nextSpinAt,
    isActive: status.isActive,
    isExpired: status.isExpired ?? false,
    likesCount: status.likesCount ?? 0,
    isEligible: status.isEligible ?? false,
    ...extra,
  }
}

async function getSpinStatusForUser(userId: string, now: Date) {
  if (!isDbConfigured()) {
    const { devGetLuckySpin } = await import('@/lib/dev-gamification')
    return devGetLuckySpin(userId)
  }
  return getLuckySpinStatus(userId, now)
}

async function generateSpinForUser(userId: string, now: Date) {
  if (!isDbConfigured()) {
    const { devGenerateLuckySpin } = await import('@/lib/dev-gamification')
    return devGenerateLuckySpin(userId)
  }
  return generateLuckySpin(userId, now)
}

async function handleSpinRequest(request: Request, forceGenerate: boolean) {
  const limit = rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés.' }, { status: 429 })
  }

  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    let status = await getSpinStatusForUser(userId, now)

    if (status.spin && status.isActive) {
      return NextResponse.json(await enrichSpinResponse(status))
    }

    if (forceGenerate && status.canSpin) {
      const result = await generateSpinForUser(userId, now)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      status = await getSpinStatusForUser(userId, now)
      return NextResponse.json(
        await enrichSpinResponse(status, { created: 'created' in result ? result.created : true })
      )
    }

    return NextResponse.json(await enrichSpinResponse(status))
  } catch (e) {
    console.error('[api/gamification/spin]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/gamification/spin
 * Státusz lekérés; ?generate=1 esetén új pörgetés (legacy).
 */
export async function GET(request: Request) {
  const forceGenerate = new URL(request.url).searchParams.get('generate') === '1'
  return handleSpinRequest(request, forceGenerate)
}

/**
 * POST /api/gamification/spin
 * Új pörgetés – LuckySpin rekord létrehozása / frissítése, 10 termék visszaadása.
 */
export async function POST(request: Request) {
  return handleSpinRequest(request, true)
}
