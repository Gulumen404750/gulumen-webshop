import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

const MAX_ID_LENGTH = 128

const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|redditbot|ia_archiver|wget|curl|python-requests|go-http|headless|preview|monitor|uptime|pingdom|statuscake|semrush|ahrefs|yandex|duckduck|baidu|bytespider/i

function isBotRequest(request: Request): boolean {
  const ua = request.headers.get('user-agent') || ''
  if (!ua.trim()) return true
  if (BOT_UA.test(ua)) return true
  const purpose =
    request.headers.get('purpose') ||
    request.headers.get('sec-purpose') ||
    request.headers.get('x-purpose') ||
    ''
  if (/prefetch|preview/i.test(purpose)) return true
  if (request.headers.get('sec-fetch-dest') === 'empty' && request.headers.get('sec-fetch-mode') === 'navigate') {
    // normal navigations are fine; prefetch often uses sec-fetch-mode: no-cors / destination empty differently
  }
  if (request.headers.get('x-middleware-prefetch') === '1') return true
  return false
}

/**
 * POST /api/products/[id]/view
 * Termékoldal megtekintés számláló. Bot / admin / rate-limit esetén nem növel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limit = await rateLimit(request)
    if (!limit.ok) {
      return NextResponse.json({ ok: true, skipped: 'rate_limit' })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true, skipped: 'no_db' })
    }

    const cookieStore = await cookies()
    const { verifyAdminSessionToken, ADMIN_COOKIE_NAME } = await import('@/lib/admin-session')
    if (await verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
      return NextResponse.json({ ok: true, skipped: 'admin' })
    }

    if (isBotRequest(request)) {
      return NextResponse.json({ ok: true, skipped: 'bot' })
    }

    const { id: productId } = await params
    if (!productId || productId.length > MAX_ID_LENGTH) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    const updated = await prisma.product.updateMany({
      where: { id: productId },
      data: { viewsCount: { increment: 1 } },
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/products/[id]/view] POST', e)
    return NextResponse.json({ ok: true, skipped: 'error' })
  }
}
