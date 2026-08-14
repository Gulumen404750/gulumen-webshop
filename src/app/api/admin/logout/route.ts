import { NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
  getAdminCookieOptions,
} from '@/lib/admin-session'
import { ADMIN_CSRF_COOKIE, getAdminCsrfCookieOptions } from '@/lib/admin-csrf'
import { logAdminAction } from '@/lib/admin-audit'

/**
 * POST /api/admin/logout
 * Törli az admin session és CSRF sütiket. GET szándékosan nincs (CSRF / logout-fixálás).
 */
export async function POST(request: Request) {
  await logAdminAction({
    action: 'logout',
    success: true,
    request,
  })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  res.cookies.set(ADMIN_2FA_PENDING_COOKIE, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  res.cookies.set(ADMIN_CSRF_COOKIE, '', { ...getAdminCsrfCookieOptions(0), maxAge: 0 })
  return res
}
