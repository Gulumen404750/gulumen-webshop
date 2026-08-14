import { NextResponse } from 'next/server'
import { requireAdminOrPendingTwoFactor } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { logAdminAction } from '@/lib/admin-audit'
import {
  buildTotpAuthUrl,
  generateTotpSecret,
  normalizeTotpCode,
  totpQrDataUrl,
  verifyTotpCode,
} from '@/lib/admin-totp'
import { getAdminTwoFactorState, saveAdminTotpSetup } from '@/lib/admin-2fa'

/**
 * POST /api/admin/2fa/setup
 * Új TOTP secret + QR.
 * Első bekapcsolás (pending login token vagy admin session): totpSecret mentése, 2FA még ki.
 * Újrapárosítás: csak teljes admin session + érvényes aktuális TOTP; az új secret pending-be kerül.
 */
export async function POST(request: Request) {
  const auth = await requireAdminOrPendingTwoFactor()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const state = await getAdminTwoFactorState()
  if (state.isTwoFactorEnabled) {
    if (auth !== 'admin') {
      await logAdminAction({
        action: '2fa_setup',
        success: false,
        request,
        details: { reason: 'pending_cannot_reenroll' },
      })
      return NextResponse.json(
        { error: 'A 2FA már aktív. Belépéshez add meg a hitelesítő kódot.' },
        { status: 401 }
      )
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
      await logAdminAction({
        action: '2fa_setup',
        success: false,
        request,
        details: { reason: 'step_up_required' },
      })
      return NextResponse.json(
        { error: 'Az újrapárosításhoz add meg a jelenlegi 6 jegyű kódot.' },
        { status: 400 }
      )
    }

    const currentSecret = state.totpSecret
    if (!currentSecret) {
      return NextResponse.json({ error: '2FA is not fully configured' }, { status: 400 })
    }

    const valid = await verifyTotpCode(currentSecret, code)
    if (!valid) {
      await logAdminAction({
        action: '2fa_setup',
        success: false,
        request,
        details: { reason: 'invalid_step_up_code' },
      })
      return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
    }
  }

  const secret = generateTotpSecret()
  const otpauthUrl = buildTotpAuthUrl(secret)
  const qrDataUrl = await totpQrDataUrl(otpauthUrl)

  await saveAdminTotpSetup(secret)
  await logAdminAction({
    action: '2fa_setup',
    success: true,
    request,
    details: { reenroll: state.isTwoFactorEnabled },
  })

  return NextResponse.json({
    ok: true,
    otpauthUrl,
    qrDataUrl,
    secret,
    issuer: 'Gulumen',
    isTwoFactorEnabled: state.isTwoFactorEnabled,
  })
}
