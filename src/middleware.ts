import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-session'

const ADMIN_PREFIX = '/admin'
const ADMIN_LOGIN = '/admin/login'

/**
 * Security middleware – minden route-on fut.
 * X-Frame-Options, CSP, HSTS, stb.
 * /admin/* (kivéve /admin/login) védve: aláírt admin JWT cookie.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith(ADMIN_PREFIX) && !pathname.startsWith(ADMIN_LOGIN)) {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const authorized = await verifyAdminSessionToken(token)
    if (!authorized) {
      const loginUrl = new URL(ADMIN_LOGIN, request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://ajax.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  )

  return response
}

export const config = {
  // /models/* ne menjen middleware-en keresztül (statikus GLB kiszolgálás)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|models/).*)'],
}
