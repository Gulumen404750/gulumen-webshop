import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  createAdminSessionToken,
  createAdminPendingTwoFactorToken,
  getAdminCookieOptions,
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  ADMIN_2FA_PENDING_MAX_AGE_SEC,
  isAdminSessionConfigured,
} from '@/lib/admin-session'
import { secureCompare } from '@/lib/secure-compare'
import { logAdminAction } from '@/lib/admin-audit'
import {
  ADMIN_CSRF_COOKIE,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
} from '@/lib/admin-csrf'
import { getAdminTwoFactorState } from '@/lib/admin-2fa'
import { isDbConfigured } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  clearAdminLoginLockout,
  getAdminLoginLockout,
  recordAdminLoginFailure,
} from '@/lib/admin-login-lockout'

/**
 * POST /api/admin/login
 * Body: { key: string }. Ha a 2FA be van kapcsolva, csak ideiglenes pending tokent ad;
 * egyébként beállítja az aláírt admin JWT cookie-t.
 */
export async function POST(request: Request) {
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

  const existingLock = await getAdminLoginLockout(request)
  if (existingLock.locked) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'locked', retryAfterSec: existingLock.retryAfterSec },
    })
    return NextResponse.json(
      {
        error: 'Túl sok hibás belépés. Próbáld újra 15 perc múlva.',
        locked: true,
        retryAfterSec: existingLock.retryAfterSec,
      },
      { status: 429, headers: { 'Retry-After': String(existingLock.retryAfterSec) } }
    )
  }

  if (!secureCompare(key, adminKey)) {
    const lock = await recordAdminLoginFailure(request)
    if (lock.locked) {
      await logAdminAction({
        action: 'login',
        success: false,
        request,
        details: { reason: 'locked', retryAfterSec: lock.retryAfterSec },
      })
      return NextResponse.json(
        {
          error: 'Túl sok hibás belépés. Próbáld újra 15 perc múlva.',
          locked: true,
          retryAfterSec: lock.retryAfterSec,
        },
        { status: 429, headers: { 'Retry-After': String(lock.retryAfterSec) } }
      )
    }
    const limit = await rateLimit(request, { preset: 'adminLogin' })
    if (!limit.ok) {
      await logAdminAction({
        action: 'login',
        success: false,
        request,
        details: { reason: 'rate_limited' },
      })
      return NextResponse.json(
        { error: 'Túl sok hibás belépés. Próbáld újra 10 perc múlva.' },
        { status: 429 }
      )
    }
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'invalid_key' },
    })
    return NextResponse.json({ error: 'Hibás API kulcs.' }, { status: 401 })
  }

  await clearAdminLoginLockout(request)

  let twoFactor: { isTwoFactorEnabled: boolean }
  try {
    twoFactor = await getAdminTwoFactorState()
  } catch (err) {
    logger.error({ err }, 'admin login 2FA state lookup failed')
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'two_factor_lookup_failed' },
    })
    return NextResponse.json({ error: 'Admin login unavailable' }, { status: 503 })
  }

  if (twoFactor.isTwoFactorEnabled) {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }
    const pending = await createAdminPendingTwoFactorToken()
    await logAdminAction({
      action: 'login',
      success: true,
      request,
      details: { step: 'pending_2fa' },
    })
    const res = NextResponse.json({ ok: true, requiresTwoFactor: true })
    res.cookies.set(
      ADMIN_2FA_PENDING_COOKIE,
      pending,
      getAdminCookieOptions(ADMIN_2FA_PENDING_MAX_AGE_SEC)
    )
    res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
    return res
  }

  const token = await createAdminSessionToken()
  await logAdminAction({
    action: 'login',
    success: true,
    request,
  })
  const res = NextResponse.json({ ok: true, requiresTwoFactor: false })
  res.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  return res
}
