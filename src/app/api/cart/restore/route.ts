import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import { loadAbandonedCartByRestoreToken } from '@/lib/cart-snapshot'
import { isLikelyRestoreToken } from '@/lib/abandoned-cart-restore'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

/**
 * GET /api/cart/restore?token=
 * Tokenes elhagyott kosár betöltés – bejelentkezés nélkül, a deep linkhez.
 */
export async function GET(request: Request) {
  const limit = await rateLimit(request, { preset: 'auth' })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés.' }, { status: 429, headers: NO_STORE })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503, headers: NO_STORE })
  }

  const url = new URL(request.url)
  const token = (url.searchParams.get('token') ?? '').trim()
  if (!isLikelyRestoreToken(token)) {
    return NextResponse.json({ error: 'Invalid token', code: 'invalid' }, { status: 400, headers: NO_STORE })
  }

  const result = await loadAbandonedCartByRestoreToken(token)
  if (!result.ok) {
    const status = result.code === 'expired' ? 410 : 404
    return NextResponse.json({ error: 'Restore link invalid', code: result.code }, { status, headers: NO_STORE })
  }

  return NextResponse.json(
    { ok: true, items: result.items, coupon: result.coupon },
    { headers: NO_STORE }
  )
}
