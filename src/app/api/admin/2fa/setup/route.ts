import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import {
  buildTotpAuthUrl,
  generateTotpSecret,
  totpQrDataUrl,
} from '@/lib/admin-totp'
import { saveAdminTotpSetup } from '@/lib/admin-2fa'

/**
 * POST /api/admin/2fa/setup
 * Új TOTP secret + QR. isTwoFactorEnabled false marad, amíg a kód meg nincs erősítve.
 */
export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const secret = generateTotpSecret()
  const otpauthUrl = buildTotpAuthUrl(secret)
  const qrDataUrl = await totpQrDataUrl(otpauthUrl)

  await saveAdminTotpSetup(secret)
  await logAdminAction({
    action: '2fa_setup',
    success: true,
    request,
  })

  return NextResponse.json({
    ok: true,
    otpauthUrl,
    qrDataUrl,
    secret,
    issuer: 'Gulumen',
  })
}
