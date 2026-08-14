import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  createAdminPendingTwoFactorToken,
  getAdminCookieOptions,
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
import { getClientIp } from '@/lib/request-ip'
import { RECAPTCHA_ACTIONS, verifyRecaptchaToken } from '@/lib/recaptcha'
import {
  MUST_CHANGE_KEY_MESSAGE,
  evaluateAdminKeyPolicy,
} from '@/lib/admin-key-policy'

/**
 * POST /api/admin/login
 * Body: { key: string }.
 * A kulcs önmagában soha nem ad teljes admin sessiont: csak ideiglenes 2FA pending tokent.
 * Ha a 2FA már be van kapcsolva → TOTP kód. Ha még nincs → első Authenticator párosítás.
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
  if (!isDbConfigured()) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'database_not_configured' },
    })
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as { key?: unknown; captchaToken?: unknown }
  const key = typeof body.key === 'string' ? body.key : ''
  const captcha = await verifyRecaptchaToken({
    token: body.captchaToken,
    action: RECAPTCHA_ACTIONS.adminLogin,
    ip: getClientIp(request),
  })
  if (!captcha.ok) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'captcha' },
    })
    return NextResponse.json({ error: captcha.error }, { status: 400 })
  }

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

  try {
    const policy = await evaluateAdminKeyPolicy(adminKey)
    if (!policy.ok) {
      await logAdminAction({
        action: 'login',
        success: false,
        request,
        details: { reason: policy.reason },
      })
      return NextResponse.json(
        { error: MUST_CHANGE_KEY_MESSAGE, code: policy.reason },
        { status: 403 }
      )
    }
  } catch (err) {
    logger.error({ err }, 'admin login key policy failed')
  }

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

  const pending = await createAdminPendingTwoFactorToken()
  const requiresTwoFactor = twoFactor.isTwoFactorEnabled
  await logAdminAction({
    action: 'login',
    success: true,
    request,
    details: { step: requiresTwoFactor ? 'pending_2fa' : 'pending_2fa_setup' },
  })
  const res = NextResponse.json({
    ok: true,
    requiresTwoFactor,
    requiresTwoFactorSetup: !requiresTwoFactor,
  })
  res.cookies.set(
    ADMIN_2FA_PENDING_COOKIE,
    pending,
    getAdminCookieOptions(ADMIN_2FA_PENDING_MAX_AGE_SEC)
  )
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  return res
}
