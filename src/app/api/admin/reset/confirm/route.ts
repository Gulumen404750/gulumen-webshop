import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { logAdminAction } from '@/lib/admin-audit'
import {
  clearAdminResetToken,
  findAdminForPasswordReset,
  isAdminResetTokenExpired,
  resetTokenMatches,
} from '@/lib/admin-password-reset'
import { hashAdminPassword, validateAdminPassword } from '@/lib/admin-password'
import { bumpAdminSessionEpoch } from '@/lib/admin-session-epoch'
import {
  ADMIN_2FA_PENDING_COOKIE,
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
} from '@/lib/admin-session'
import { ADMIN_CSRF_COOKIE, getAdminCsrfCookieOptions } from '@/lib/admin-csrf'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { ADMIN_RECORD_ID } from '@/lib/admin-session-constants'
import { getAdminTwoFactorState } from '@/lib/admin-2fa'
import { normalizeTotpCode, verifyTotpCode } from '@/lib/admin-totp'
import { logger } from '@/lib/logger'

const INVALID_LINK = 'A link érvénytelen vagy lejárt.'

function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  res.cookies.set(ADMIN_2FA_PENDING_COOKIE, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  res.cookies.set(ADMIN_CSRF_COOKIE, '', { ...getAdminCsrfCookieOptions(0), maxAge: 0 })
}

/**
 * POST /api/admin/reset/confirm
 * Body: { token, password, totpCode }
 * 2. csatorna: TOTP kötelező. Sikeres csere után session epoch nő. A nyers API kulcs nem megy sehova.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, { preset: 'adminResetConfirm' })
  if (!limit.ok) {
    await logAdminAction({
      action: 'password_reset_confirm',
      success: false,
      request,
      details: { reason: 'rate_limited' },
    })
    return NextResponse.json(
      { error: 'Túl sok próbálkozás. Próbáld újra később.' },
      { status: 429 }
    )
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const totpCode = normalizeTotpCode(body?.totpCode ?? body?.code)

  if (!token) {
    return NextResponse.json({ error: INVALID_LINK }, { status: 400 })
  }

  const passwordCheck = validateAdminPassword(password)
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
  }

  let admin
  try {
    admin = await findAdminForPasswordReset()
  } catch (err) {
    logger.error({ err }, 'admin password reset confirm lookup failed')
    return NextResponse.json({ error: 'A visszaállítás most nem elérhető.' }, { status: 503 })
  }

  if (
    !admin ||
    !resetTokenMatches(token, admin.passwordResetTokenHash) ||
    isAdminResetTokenExpired(admin.passwordResetExpiresAt)
  ) {
    if (admin && isAdminResetTokenExpired(admin.passwordResetExpiresAt) && admin.passwordResetTokenHash) {
      await clearAdminResetToken()
    }
    await logAdminAction({
      action: 'password_reset_confirm',
      success: false,
      request,
      details: { reason: 'invalid_or_expired_token' },
    })
    return NextResponse.json({ error: INVALID_LINK }, { status: 400 })
  }

  const twoFactor = await getAdminTwoFactorState()
  if (!twoFactor.isTwoFactorEnabled || !twoFactor.totpSecret) {
    await logAdminAction({
      action: 'password_reset_confirm',
      success: false,
      request,
      details: { reason: 'totp_required' },
    })
    return NextResponse.json(
      { error: 'A visszaállításhoz a 2FA-nak be kell lennie kapcsolva, és add meg a 6 jegyű kódot.' },
      { status: 401 }
    )
  }
  if (!totpCode) {
    await logAdminAction({
      action: 'password_reset_confirm',
      success: false,
      request,
      details: { reason: 'totp_required' },
    })
    return NextResponse.json(
      { error: 'Add meg a hitelesítő alkalmazás 6 jegyű kódját.' },
      { status: 401 }
    )
  }
  const totpOk = await verifyTotpCode(twoFactor.totpSecret, totpCode)
  if (!totpOk) {
    await logAdminAction({
      action: 'password_reset_confirm',
      success: false,
      request,
      details: { reason: 'invalid_totp' },
    })
    return NextResponse.json({ error: 'Érvénytelen hitelesítő kód.' }, { status: 401 })
  }

  try {
    const passwordHash = await hashAdminPassword(password)
    const now = new Date()
    await prisma.admin.update({
      where: { id: ADMIN_RECORD_ID },
      data: {
        passwordHash,
        passwordSetAt: now,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    })
    await bumpAdminSessionEpoch()
  } catch (err) {
    logger.error({ err }, 'admin password reset confirm write failed')
    await logAdminAction({
      action: 'password_reset_confirm',
      success: false,
      request,
      details: { reason: 'write_failed' },
    })
    return NextResponse.json({ error: 'A jelszó mentése sikertelen.' }, { status: 503 })
  }

  await logAdminAction({
    action: 'password_reset_confirm',
    success: true,
    request,
  })

  const res = NextResponse.json({ ok: true })
  clearAuthCookies(res)
  return res
}
