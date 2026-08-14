import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { logAdminAction } from '@/lib/admin-audit'
import { getAdminTwoFactorState } from '@/lib/admin-2fa'
import { normalizeTotpCode, verifyTotpCode } from '@/lib/admin-totp'
import {
  getAdminPasswordState,
  hashAdminPassword,
  saveAdminPasswordHash,
  validateAdminPassword,
  verifyAdminPassword,
} from '@/lib/admin-password'
import { bumpAdminSessionEpoch } from '@/lib/admin-session-epoch'
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
  isAdminSessionConfigured,
} from '@/lib/admin-session'
import {
  ADMIN_CSRF_COOKIE,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
} from '@/lib/admin-csrf'

/**
 * GET /api/admin/password
 * Van-e már admin jelszó (a beállítások UI-hoz). A hash soha nem megy ki.
 */
export async function GET() {
  const gate = await requireAdminPermission('settings:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const [password, twoFactor] = await Promise.all([
    getAdminPasswordState(),
    getAdminTwoFactorState(),
  ])
  return NextResponse.json({
    passwordSet: Boolean(password.passwordHash),
    passwordSetAt: password.passwordSetAt,
    requiresTwoFactor: twoFactor.isTwoFactorEnabled,
  })
}

/**
 * POST /api/admin/password
 * Body: { newPassword, currentPassword?, totpCode? }
 * Belépve állítja / cseréli a jelszót. 2FA esetén TOTP step-up.
 */
export async function POST(request: Request) {
  const gate = await requireAdminPermission('settings:write')
  if (!gate.ok) return gate.response
  const actor = gate.actor
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  if (!isAdminSessionConfigured()) {
    return NextResponse.json({ error: 'Admin session not configured' }, { status: 503 })
  }

  const limit = await rateLimit(request, { preset: 'adminLogin' })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Túl sok próbálkozás. Próbáld újra később.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const totpCode = normalizeTotpCode(body?.totpCode ?? body?.code)

  const passwordCheck = validateAdminPassword(newPassword)
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
  }

  const [state, twoFactor] = await Promise.all([
    getAdminPasswordState(),
    getAdminTwoFactorState(),
  ])

  if (state.passwordHash) {
    if (!currentPassword || !(await verifyAdminPassword(currentPassword, state.passwordHash))) {
      await logAdminAction({
        action: 'password_change',
        success: false,
        request,
        details: { reason: 'invalid_current_password' },
      })
      return NextResponse.json({ error: 'A jelenlegi jelszó hibás.' }, { status: 401 })
    }
  }

  if (twoFactor.isTwoFactorEnabled) {
    if (!twoFactor.totpSecret || !totpCode) {
      return NextResponse.json(
        { error: 'A 2FA be van kapcsolva: add meg a hitelesítő alkalmazás 6 jegyű kódját.' },
        { status: 401 }
      )
    }
    const totpOk = await verifyTotpCode(twoFactor.totpSecret, totpCode)
    if (!totpOk) {
      await logAdminAction({
        action: 'password_change',
        success: false,
        request,
        details: { reason: 'invalid_totp' },
      })
      return NextResponse.json({ error: 'Érvénytelen hitelesítő kód.' }, { status: 401 })
    }
  }

  const passwordHash = await hashAdminPassword(newPassword)
  await saveAdminPasswordHash(passwordHash)
  await bumpAdminSessionEpoch()
  const token = await createAdminSessionToken(actor)

  await logAdminAction({
    action: 'password_change',
    success: true,
    request,
    actor,
    details: { firstSet: !state.passwordHash },
  })

  const res = NextResponse.json({ ok: true, passwordSet: true })
  res.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  return res
}
