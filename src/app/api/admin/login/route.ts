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
import { resolveOwnerLoginActor } from '@/lib/admin-operators'
import type { AdminActor } from '@/lib/admin-rbac'
import { recordAdminLoginFingerprintSafe } from '@/lib/admin-login-alert'
import { MUST_CHANGE_KEY_MESSAGE, evaluateAdminKeyPolicy } from '@/lib/admin-key-policy'
import { getAdminPasswordState, verifyAdminPassword } from '@/lib/admin-password'

/**
 * POST /api/admin/login — Owner path.
 * Body: { key: string, password?: string }.
 * ADMIN_API_KEY mindig kötelező; soha nem ad teljes sessiont, csak 2FA pending tokent.
 * Unbreakable fallback: owner megléte esetén is API-kulcs + 2FA → bootstrap owner session
 * (`admin_authorized`), SQL / emergency env nélkül.
 * Az operátor belépés: `/operator/login` (külön süti).
 */
export async function POST(request: Request) {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'not_configured', path: 'owner' },
    })
    return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
  }
  if (!isAdminSessionConfigured()) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'session_not_configured', path: 'owner' },
    })
    return NextResponse.json({ error: 'Admin session not configured' }, { status: 503 })
  }
  if (!isDbConfigured()) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'database_not_configured', path: 'owner' },
    })
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    key?: unknown
    captchaToken?: unknown
    password?: unknown
  }
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
      details: { reason: 'captcha', path: 'owner' },
    })
    return NextResponse.json({ error: captcha.error }, { status: 400 })
  }

  const existingLock = await getAdminLoginLockout(request)
  if (existingLock.locked) {
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'locked', retryAfterSec: existingLock.retryAfterSec, path: 'owner' },
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
        details: { reason: 'locked', retryAfterSec: lock.retryAfterSec, path: 'owner' },
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
        details: { reason: 'rate_limited', path: 'owner' },
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
      details: { reason: 'invalid_key', path: 'owner' },
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
        details: { reason: policy.reason, path: 'owner' },
      })
      return NextResponse.json(
        { error: MUST_CHANGE_KEY_MESSAGE, code: policy.reason },
        { status: 403 }
      )
    }
  } catch (err) {
    logger.error({ err }, 'admin login key policy failed')
  }

  const loginActor = await resolveOwnerLoginActor({})
  if (!loginActor.ok) {
    return NextResponse.json({ error: 'Owner login unavailable' }, { status: 503 })
  }
  const actor: AdminActor = loginActor.actor

  const rawPassword = typeof body.password === 'string' ? body.password : ''
  if (actor.bootstrap) {
    try {
      const passwordState = await getAdminPasswordState()
      if (passwordState.passwordHash) {
        const passwordOk = rawPassword
          ? await verifyAdminPassword(rawPassword, passwordState.passwordHash)
          : false
        if (!passwordOk) {
          const lock = await recordAdminLoginFailure(request)
          await logAdminAction({
            action: 'login',
            success: false,
            request,
            details: { reason: 'invalid_admin_password', locked: lock.locked, path: 'owner' },
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
          return NextResponse.json({ error: 'Hibás jelszó.' }, { status: 401 })
        }
      }
    } catch (err) {
      logger.error({ err }, 'admin login password lookup failed')
    }
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
      details: { reason: 'two_factor_lookup_failed', path: 'owner' },
    })
    return NextResponse.json({ error: 'Admin login unavailable' }, { status: 503 })
  }

  const pending = await createAdminPendingTwoFactorToken(actor, 'owner')
  const requiresTwoFactor = twoFactor.isTwoFactorEnabled
  await recordAdminLoginFingerprintSafe(request)
  await logAdminAction({
    action: 'login',
    success: true,
    request,
    actor,
    details: {
      step: requiresTwoFactor ? 'pending_2fa' : 'pending_2fa_setup',
      username: actor.username,
      role: actor.role,
      bootstrap: Boolean(actor.bootstrap),
      path: 'owner',
      scope: 'owner',
    },
  })
  const res = NextResponse.json({
    ok: true,
    requiresTwoFactor,
    requiresTwoFactorSetup: !requiresTwoFactor,
    scope: 'owner',
  })
  res.cookies.set(
    ADMIN_2FA_PENDING_COOKIE,
    pending,
    getAdminCookieOptions(ADMIN_2FA_PENDING_MAX_AGE_SEC)
  )
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  return res
}
