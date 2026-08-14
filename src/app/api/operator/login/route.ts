import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  createAdminSessionToken,
  getAdminCookieOptions,
  isAdminSessionConfigured,
  OPERATOR_COOKIE_NAME,
} from '@/lib/admin-session'
import { logAdminAction } from '@/lib/admin-audit'
import {
  ADMIN_CSRF_COOKIE,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
} from '@/lib/admin-csrf'
import { isDbConfigured } from '@/lib/prisma'
import {
  clearAdminLoginLockout,
  getAdminLoginLockout,
  recordAdminLoginFailure,
} from '@/lib/admin-login-lockout'
import { getClientIp } from '@/lib/request-ip'
import { RECAPTCHA_ACTIONS, verifyRecaptchaToken } from '@/lib/recaptcha'
import { resolveOperatorLoginActor } from '@/lib/admin-operators'
import { recordAdminLoginFingerprintSafe } from '@/lib/admin-login-alert'

/**
 * POST /api/operator/login — másodlagos operátor path.
 * Body: { username, password, captchaToken? }.
 * Nincs ADMIN_API_KEY; a session az `operator_authorized` sütibe kerül,
 * az owner `admin_authorized` süti érintetlen marad.
 */
export async function POST(request: Request) {
  if (!isAdminSessionConfigured()) {
    await logAdminAction({
      action: 'operator_login',
      success: false,
      request,
      details: { reason: 'session_not_configured' },
    })
    return NextResponse.json({ error: 'Admin session not configured' }, { status: 503 })
  }
  if (!isDbConfigured()) {
    await logAdminAction({
      action: 'operator_login',
      success: false,
      request,
      details: { reason: 'database_not_configured' },
    })
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    username?: unknown
    password?: unknown
    captchaToken?: unknown
  }

  const captcha = await verifyRecaptchaToken({
    token: body.captchaToken,
    action: RECAPTCHA_ACTIONS.adminLogin,
    ip: getClientIp(request),
  })
  if (!captcha.ok) {
    await logAdminAction({
      action: 'operator_login',
      success: false,
      request,
      details: { reason: 'captcha' },
    })
    return NextResponse.json({ error: captcha.error }, { status: 400 })
  }

  const existingLock = await getAdminLoginLockout(request)
  if (existingLock.locked) {
    await logAdminAction({
      action: 'operator_login',
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

  const loginActor = await resolveOperatorLoginActor({
    username: body.username,
    password: body.password,
  })
  if (!loginActor.ok) {
    if (loginActor.code === 'invalid_input') {
      await logAdminAction({
        action: 'operator_login',
        success: false,
        request,
        details: { reason: 'invalid_input' },
      })
      return NextResponse.json(
        {
          error:
            'Érvénytelen operátor adat. Felhasználónév: 3–32 karakter (a–z, 0–9, ._-). Jelszó: legalább 10 karakter.',
        },
        { status: 400 }
      )
    }
    const lock = await recordAdminLoginFailure(request)
    const limit = await rateLimit(request, { preset: 'adminLogin' })
    await logAdminAction({
      action: 'operator_login',
      success: false,
      request,
      details: { reason: 'invalid_credentials', locked: lock.locked },
    })
    if (lock.locked) {
      return NextResponse.json(
        {
          error: 'Túl sok hibás belépés. Próbáld újra 15 perc múlva.',
          locked: true,
          retryAfterSec: lock.retryAfterSec,
        },
        { status: 429, headers: { 'Retry-After': String(lock.retryAfterSec) } }
      )
    }
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Túl sok hibás belépés. Próbáld újra 10 perc múlva.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Hibás felhasználónév vagy jelszó.' }, { status: 401 })
  }

  await clearAdminLoginLockout(request)
  const actor = loginActor.actor
  const token = await createAdminSessionToken(actor)
  await recordAdminLoginFingerprintSafe(request)
  await logAdminAction({
    action: 'operator_login',
    success: true,
    request,
    actor,
    details: {
      username: actor.username,
      role: actor.role,
      scope: 'operator',
    },
  })

  const res = NextResponse.json({
    ok: true,
    scope: 'operator',
    role: actor.role,
    username: actor.username,
  })
  // Owner süti NEM törlődik / NEM íródik felül — session izoláció.
  res.cookies.set(OPERATOR_COOKIE_NAME, token, getAdminCookieOptions())
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  return res
}
