import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  OPERATOR_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
  isAdminSessionConfigured,
  parseAdminPendingTwoFactorSession,
  sessionCookieNameForScope,
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
import { recordAdminLoginFingerprintSafe } from '@/lib/admin-login-alert'
import {
  softCheckAdminKeyPolicyForOwnerLogin,
  recordAdminKeyAccepted,
} from '@/lib/admin-key-policy'
import { logger } from '@/lib/logger'

function clearPendingCookie(res: NextResponse) {
  res.cookies.set(ADMIN_2FA_PENDING_COOKIE, '', {
    ...getAdminCookieOptions(0),
    maxAge: 0,
  })
}

/**
 * POST /api/admin/2fa/verify-login
 * Body: { code: string, pendingToken?: string }
 * Owner scope → `admin_authorized` (operátor süti érintetlen).
 * Operator scope → `operator_authorized` (owner süti érintetlen).
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

  const pending = await parseAdminPendingTwoFactorSession(pendingToken)
  if (!pending) {
    await logAdminAction({
      action: 'login_2fa',
      success: false,
      request,
      details: { reason: 'invalid_pending' },
    })
    const res = NextResponse.json(
      { error: 'A 2FA munkamenet lejárt. Add meg újra az API kulcsot.' },
      { status: 401 }
    )
    clearPendingCookie(res)
    return res
  }
  const { actor: pendingActor, scope } = pending

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

  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
  }
  // Soft: mustChangeKey / lejárat nem zárhatja ki a 2FA utáni sessiont – feloldás recordAdminKeyAccepted-tel.
  try {
    const policy = await softCheckAdminKeyPolicyForOwnerLogin(adminKey)
    if (!policy.ok) {
      await logAdminAction({
        action: 'login_2fa',
        success: true,
        request,
        details: { reason: 'key_policy_bypass', policy: policy.reason },
      })
    }
  } catch (err) {
    logger.error({ err }, 'admin 2FA login key policy soft-check failed')
  }

  const token = await createAdminSessionToken(pendingActor)
  await recordAdminKeyAccepted(adminKey)
  await recordAdminLoginFingerprintSafe(request)

  const cookieName = sessionCookieNameForScope(scope)

  await logAdminAction({
    action: 'login_2fa',
    success: true,
    request,
    actor: pendingActor,
    details: {
      username: pendingActor.username,
      role: pendingActor.role,
      scope,
      cookie: cookieName,
    },
  })

  const finalRes = NextResponse.json({ ok: true, scope })
  finalRes.cookies.set(cookieName, token, getAdminCookieOptions())
  // Izoláció: a másik scope sütijét nem töröljük / nem írjuk felül.
  if (cookieName === ADMIN_COOKIE_NAME) {
    // Owner belépés: operátor süti maradhat (ritka); nem park kell már.
    void OPERATOR_COOKIE_NAME
  }
  finalRes.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  clearPendingCookie(finalRes)
  return finalRes
}
