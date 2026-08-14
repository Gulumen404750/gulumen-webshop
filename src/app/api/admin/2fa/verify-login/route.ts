import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  createAdminSessionToken,
  getAdminCookieOptions,
  isAdminSessionConfigured,
  verifyAdminPendingTwoFactorToken,
} from '@/lib/admin-session'
import {
  ADMIN_CSRF_COOKIE,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
} from '@/lib/admin-csrf'
import { logAdminAction } from '@/lib/admin-audit'
import { getAdminTwoFactorState } from '@/lib/admin-2fa'
import { isDbConfigured } from '@/lib/prisma'
import { normalizeTotpCode, verifyTotpCode } from '@/lib/admin-totp'

function clearPendingCookie(res: NextResponse) {
  res.cookies.set(ADMIN_2FA_PENDING_COOKIE, '', {
    ...getAdminCookieOptions(0),
    maxAge: 0,
  })
}

/**
 * POST /api/admin/2fa/verify-login
 * Body: { code: string, pendingToken?: string }
 * Az ideiglenes 2FA JWT (süti vagy body) + TOTP kód után kiadja a teljes admin sütit.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, { preset: 'adminTotp' })
  if (!limit.ok) {
    await logAdminAction({
      action: 'login_2fa',
      success: false,
      request,
      details: { reason: 'rate_limited' },
    })
    return NextResponse.json(
      { error: 'Túl sok hibás kód. Próbáld újra 10 perc múlva.' },
      { status: 429 }
    )
  }

  if (!isAdminSessionConfigured()) {
    return NextResponse.json({ error: 'Admin session not configured' }, { status: 503 })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const code = normalizeTotpCode(body?.code)
  if (!code) {
    return NextResponse.json({ error: 'A kód 6 számjegy legyen.' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const pendingFromCookie = cookieStore.get(ADMIN_2FA_PENDING_COOKIE)?.value
  const pendingFromBody = typeof body?.pendingToken === 'string' ? body.pendingToken : ''
  const pendingToken = pendingFromCookie || pendingFromBody

  const pendingOk = await verifyAdminPendingTwoFactorToken(pendingToken)
  if (!pendingOk) {
    await logAdminAction({
      action: 'login_2fa',
      success: false,
      request,
      details: { reason: 'invalid_pending' },
    })
    const res = NextResponse.json(
      { error: 'A 2FA munkamenet lejárt. Add meg újra a jelszót vagy az API kulcsot.' },
      { status: 401 }
    )
    clearPendingCookie(res)
    return res
  }

  const state = await getAdminTwoFactorState()
  if (!state.isTwoFactorEnabled || !state.totpSecret) {
    await logAdminAction({
      action: 'login_2fa',
      success: false,
      request,
      details: { reason: 'two_factor_not_enabled' },
    })
    return NextResponse.json({ error: 'Two-factor is not enabled' }, { status: 400 })
  }

  const valid = await verifyTotpCode(state.totpSecret, code)
  if (!valid) {
    await logAdminAction({
      action: 'login_2fa',
      success: false,
      request,
      details: { reason: 'invalid_code' },
    })
    return NextResponse.json({ error: 'Érvénytelen hitelesítő kód.' }, { status: 401 })
  }

  const token = await createAdminSessionToken()
  await logAdminAction({
    action: 'login_2fa',
    success: true,
    request,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  clearPendingCookie(res)
  return res
}
