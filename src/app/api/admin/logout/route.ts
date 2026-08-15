import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  OPERATOR_COOKIE_NAME,
  getAdminCookieOptions,
  parseAdminSessionToken,
  revokeAdminSessionToken,
} from '@/lib/admin-session'
import { ADMIN_CSRF_COOKIE, getAdminCsrfCookieOptions } from '@/lib/admin-csrf'
import { clearParkedAdminSessionCookie } from '@/lib/admin-session-park'
import { logAdminAction } from '@/lib/admin-audit'

/**
 * POST /api/admin/logout
 * Body (opcionális): { scope?: 'active' | 'all' }
 * - active (alap): csak az aktív sessiont törli (operátor süti, ha van; különben owner).
 *   Így az operátor kijelentkezése nem lépteti ki a párhuzamos owner sessiont.
 * - all: mindkét süti + parked.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const ownerToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const operatorToken = cookieStore.get(OPERATOR_COOKIE_NAME)?.value

  const body = (await request.json().catch(() => ({}))) as { scope?: unknown }
  const scope = body.scope === 'all' ? 'all' : 'active'

  const operatorParsed = await parseAdminSessionToken(operatorToken)
  const ownerParsed = await parseAdminSessionToken(ownerToken)
  const activeIsOperator = Boolean(
    operatorParsed && !operatorParsed.bootstrap && operatorParsed.id !== 'admin'
  )

  const res = NextResponse.json({
    ok: true,
    cleared: scope === 'all' ? 'all' : activeIsOperator ? 'operator' : 'owner',
    preservedOwner: scope === 'active' && activeIsOperator && Boolean(ownerParsed),
  })

  if (scope === 'all') {
    await revokeAdminSessionToken(ownerToken)
    await revokeAdminSessionToken(operatorToken)
    res.cookies.set(ADMIN_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
    res.cookies.set(OPERATOR_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
    clearParkedAdminSessionCookie(res)
  } else if (activeIsOperator) {
    await revokeAdminSessionToken(operatorToken)
    res.cookies.set(OPERATOR_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  } else {
    await revokeAdminSessionToken(ownerToken)
    res.cookies.set(ADMIN_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
    clearParkedAdminSessionCookie(res)
  }

  res.cookies.set(ADMIN_2FA_PENDING_COOKIE, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  // CSRF cookie csak akkor törlődik, ha nincs megmaradó session
  const stillHasSession =
    scope === 'active' &&
    ((activeIsOperator && ownerParsed) || (!activeIsOperator && operatorParsed))
  if (!stillHasSession) {
    res.cookies.set(ADMIN_CSRF_COOKIE, '', { ...getAdminCsrfCookieOptions(0), maxAge: 0 })
  }

  await logAdminAction({
    action: 'logout',
    success: true,
    request,
    details: {
      scope,
      cleared: scope === 'all' ? 'all' : activeIsOperator ? 'operator' : 'owner',
      preservedOwner: scope === 'active' && activeIsOperator && Boolean(ownerParsed),
    },
  })

  return res
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
