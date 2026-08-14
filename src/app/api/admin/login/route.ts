import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  createAdminSessionToken,
  getAdminCookieOptions,
  ADMIN_COOKIE_NAME,
  isAdminSessionConfigured,
} from '@/lib/admin-session'
import { secureCompare } from '@/lib/secure-compare'
import { logAdminAction } from '@/lib/admin-audit'
import {
  ADMIN_CSRF_COOKIE,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
} from '@/lib/admin-csrf'

/**
 * POST /api/admin/login
 * Body: { key: string }. Ha key === ADMIN_API_KEY, beállítja az aláírt admin JWT cookie-t.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, { preset: 'adminLogin' })
  if (!limit.ok) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'rate_limited' },
    })
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429 }
    )
  }

  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'not_configured' },
    })
    return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
  }
  if (!isAdminSessionConfigured()) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'session_not_configured' },
    })
    return NextResponse.json({ error: 'Admin session not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const key = typeof body?.key === 'string' ? body.key : ''
  if (!secureCompare(key, adminKey)) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'invalid_key' },
    })
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 })
  }

  const token = await createAdminSessionToken()
  await logAdminAction({
    action: 'login',
    success: true,
    request,
  })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  return res
}
