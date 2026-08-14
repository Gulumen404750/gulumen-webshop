import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
  parseAdminSessionToken,
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
 * Visszaállítja a parkolt owner/bootstrap sessiont (teszt-operátor belépés után).
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const parked = cookieStore.get(ADMIN_PARKED_COOKIE_NAME)?.value
  if (!parked) {
    return NextResponse.json(
      { error: 'Nincs parkolt owner session. Inkognitó ablakban teszteltél, vagy lejárt.' },
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

  // Jelenlegi (teszt) session nem kötelező, de ha van, auditoljuk.
  const current = await requireAdmin()
  await logAdminAction({
    action: 'session_restore',
    success: true,
    request,
    actor: restored,
    details: {
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
  res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  clearParkedAdminSessionCookie(res)
  return res
}
