import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { logAdminAction } from '@/lib/admin-audit'
import {
  ADMIN_PASSWORD_RESET_GENERIC_MESSAGE,
  issueAdminPasswordResetEmail,
} from '@/lib/admin-password-reset'
import { logger } from '@/lib/logger'

function genericOk() {
  return NextResponse.json({ ok: true, message: ADMIN_PASSWORD_RESET_GENERIC_MESSAGE })
}

/**
 * POST /api/admin/reset/request
 * Kétlépcsős reset 1. csatorna: e-mail a ADMIN_EMAIL címre, 15 perces token.
 * A válasz mindig ugyanaz (nincs fiók-enumeráció). Rate limit: 3 / óra / IP.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, { preset: 'adminResetRequest' })
  if (!limit.ok) {
    await logAdminAction({
      action: 'password_reset_request',
      success: false,
      request,
      details: { reason: 'rate_limited' },
    })
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429 }
    )
  }

  try {
    const result = await issueAdminPasswordResetEmail()
    await logAdminAction({
      action: 'password_reset_request',
      success: result.issued,
      request,
      details: { reason: result.issued ? 'sent' : result.reason },
    })
  } catch (err) {
    logger.error({ err }, 'admin password reset request failed')
    await logAdminAction({
      action: 'password_reset_request',
      success: false,
      request,
      details: { reason: 'error' },
    })
  }

  return genericOk()
}
