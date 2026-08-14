import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ADMIN_COOKIE_NAME,
  OPERATOR_COOKIE_NAME,
  getAdminCookieOptions,
  parseAdminSessionToken,
  revokeAdminSessionToken,
} from '@/lib/admin-session'
import {
  ADMIN_CSRF_COOKIE,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
} from '@/lib/admin-csrf'
import {
  ADMIN_PARKED_COOKIE_NAME,
  clearParkedAdminSessionCookie,
} from '@/lib/admin-session-park'
import { logAdminAction } from '@/lib/admin-audit'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * POST /api/admin/session/restore
 * Vissza az owner sessionhöz: törli az operátor sütit (owner süti megmarad),
 * vagy a legacy parked cookie-t állítja vissza.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const ownerToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const operatorToken = cookieStore.get(OPERATOR_COOKIE_NAME)?.value
  const parked = cookieStore.get(ADMIN_PARKED_COOKIE_NAME)?.value

  const ownerActor = ownerToken ? await parseAdminSessionToken(ownerToken) : null
  const hasDormantOwner =
    Boolean(operatorToken) &&
    ownerActor &&
    (ownerActor.bootstrap || ownerActor.role === 'owner')

  if (hasDormantOwner && ownerToken) {
    const current = await requireAdmin()
    await revokeAdminSessionToken(operatorToken)
    await logAdminAction({
      action: 'session_restore',
      success: true,
      request,
      actor: ownerActor,
      details: {
        mode: 'clear_operator_cookie',
        fromUsername: current?.username,
        fromRole: current?.role,
        toUsername: ownerActor.username,
        toRole: ownerActor.role,
      },
    })
    const res = NextResponse.json({
      ok: true,
      username: ownerActor.username,
      role: ownerActor.role,
    })
    res.cookies.set(OPERATOR_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
    res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
    clearParkedAdminSessionCookie(res)
    return res
  }

  if (!parked) {
    return NextResponse.json(
      {
        error:
          'Nincs megőrzött owner session. Lépj be /admin/login-nal, vagy használd a külön owner sütit.',
      },
      { status: 404 }
    )
  }

  const restored = await parseAdminSessionToken(parked)
  if (!restored || (restored.role !== 'owner' && !restored.bootstrap)) {
    const res = NextResponse.json(
      { error: 'A parkolt session érvénytelen vagy lejárt. Lépj be újra ownerként.' },
      { status: 401 }
    )
    clearParkedAdminSessionCookie(res)
    return res
  }

  const current = await requireAdmin()
  await revokeAdminSessionToken(operatorToken)
  await logAdminAction({
    action: 'session_restore',
    success: true,
    request,
    actor: restored,
    details: {
      mode: 'parked_cookie',
      fromUsername: current?.username,
      fromRole: current?.role,
      toUsername: restored.username,
      toRole: restored.role,
    },
  })

  const res = NextResponse.json({
    ok: true,
    username: restored.username,
    role: restored.role,
  })
  res.cookies.set(ADMIN_COOKIE_NAME, parked, getAdminCookieOptions())
  res.cookies.set(OPERATOR_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  clearParkedAdminSessionCookie(res)
  return res
}
