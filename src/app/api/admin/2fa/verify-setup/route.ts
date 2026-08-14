import { NextResponse } from 'next/server'
import { getPendingAdminActor, requireAdminOrPendingTwoFactor } from '@/lib/admin-auth'
import { BOOTSTRAP_ADMIN_ACTOR } from '@/lib/admin-rbac'
import { isDbConfigured } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { logAdminAction } from '@/lib/admin-audit'
import { confirmAdminTotpSetup, getAdminTwoFactorState } from '@/lib/admin-2fa'
import { normalizeTotpCode, verifyTotpCode } from '@/lib/admin-totp'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  OPERATOR_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
  isAdminSessionConfigured,
} from '@/lib/admin-session'
import {
  ADMIN_CSRF_COOKIE,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
} from '@/lib/admin-csrf'
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
 * POST /api/admin/2fa/verify-setup
 * Body: { code: string } – Google Authenticator 6 jegyű kód.
 * Első bekapcsolás: az aktív totpSecret kódja; pending login tokennel teljes sessiont ad.
 * Újrapárosítás: a pending secret kódja (pending → aktív, 2FA bekapcsolva marad).
 */
export async function POST(request: Request) {
  const auth = await requireAdminOrPendingTwoFactor()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  if (auth === 'pending' && !isAdminSessionConfigured()) {
    return NextResponse.json({ error: 'Admin session not configured' }, { status: 503 })
  }

  const limit = await rateLimit(request, { preset: 'adminTotp' })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const code = normalizeTotpCode(body?.code)
  if (!code) {
    return NextResponse.json({ error: 'A kód 6 számjegy legyen.' }, { status: 400 })
  }

  const state = await getAdminTwoFactorState()
  const secretToVerify = state.pendingTotpSecret || state.totpSecret
  if (!secretToVerify) {
    await logAdminAction({
      action: '2fa_verify_setup',
      success: false,
      request,
      details: { reason: 'no_secret' },
    })
    return NextResponse.json({ error: '2FA setup not started' }, { status: 400 })
  }

  const valid = await verifyTotpCode(secretToVerify, code)
  if (!valid) {
    await logAdminAction({
      action: '2fa_verify_setup',
      success: false,
      request,
      details: { reason: 'invalid_code' },
    })
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  if (auth === 'pending') {
    const adminKey = process.env.ADMIN_API_KEY
    if (!adminKey) {
      return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
    }
    // Soft: mustChangeKey nem zárhatja ki az első 2FA setupot sem.
    try {
      const policy = await softCheckAdminKeyPolicyForOwnerLogin(adminKey)
      if (!policy.ok) {
        await logAdminAction({
          action: '2fa_verify_setup',
          success: true,
          request,
          details: { reason: 'key_policy_bypass', policy: policy.reason },
        })
      }
    } catch (err) {
      logger.error({ err }, 'admin 2FA setup key policy soft-check failed')
    }
  }

  await confirmAdminTotpSetup()
  await logAdminAction({
    action: '2fa_verify_setup',
    success: true,
    request,
    details: { reenroll: Boolean(state.pendingTotpSecret) },
  })

  const res = NextResponse.json({ ok: true, isTwoFactorEnabled: true })
  if (auth === 'pending') {
    const actor = (await getPendingAdminActor()) ?? BOOTSTRAP_ADMIN_ACTOR
    const token = await createAdminSessionToken(actor)
    const adminKey = process.env.ADMIN_API_KEY
    if (adminKey) await recordAdminKeyAccepted(adminKey)
    await recordAdminLoginFingerprintSafe(request)
    const cookieName =
      actor.bootstrap || actor.role === 'owner' ? ADMIN_COOKIE_NAME : OPERATOR_COOKIE_NAME
    res.cookies.set(cookieName, token, getAdminCookieOptions())
    res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
    clearPendingCookie(res)
  }
  return res
}
