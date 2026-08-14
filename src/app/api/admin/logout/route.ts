import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  getAdminCookieOptions,
  revokeAdminSessionToken,
} from '@/lib/admin-session'
import { ADMIN_CSRF_COOKIE, getAdminCsrfCookieOptions } from '@/lib/admin-csrf'
import { clearParkedAdminSessionCookie } from '@/lib/admin-session-park'
import { logAdminAction } from '@/lib/admin-audit'

/**
 * POST /api/admin/logout
 * Törli a sütiket és a JWT jti-t denylistára teszi. GET szándékosan nincs.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  await revokeAdminSessionToken(token)
  await logAdminAction({
    action: 'logout',
    success: true,
    request,
  })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  res.cookies.set(ADMIN_2FA_PENDING_COOKIE, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  res.cookies.set(ADMIN_CSRF_COOKIE, '', { ...getAdminCsrfCookieOptions(0), maxAge: 0 })
  clearParkedAdminSessionCookie(res)
  return res
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
