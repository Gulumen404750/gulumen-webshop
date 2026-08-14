import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { logAdminAction } from '@/lib/admin-audit'
import { confirmAdminTotpSetup, getAdminTwoFactorState } from '@/lib/admin-2fa'
import { normalizeTotpCode, verifyTotpCode } from '@/lib/admin-totp'

/**
 * POST /api/admin/2fa/verify-setup
 * Body: { code: string } – Google Authenticator 6 jegyű kód.
 * Első bekapcsolás: az aktív totpSecret kódja. Újrapárosítás: a pending secret kódja
 * (pending → aktív, pending törlése, 2FA bekapcsolva marad).
 */
export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
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

  await confirmAdminTotpSetup()
  await logAdminAction({
    action: '2fa_verify_setup',
    success: true,
    request,
    details: { reenroll: Boolean(state.pendingTotpSecret) },
  })
  return NextResponse.json({ ok: true, isTwoFactorEnabled: true })
}
