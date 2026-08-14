import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-session-edge'
import { evaluateAdminIpAccess, isAdminIpRestrictedPath } from '@/lib/admin-ip-allowlist'
import { getClientIp } from '@/lib/request-ip'
import {
  ADMIN_CSRF_COOKIE,
  evaluateAdminCsrf,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
  isAdminApiPath,
} from '@/lib/admin-csrf'
import { applySecurityHeaders } from '@/lib/admin-security-headers'

const ADMIN_PREFIX = '/admin'
const ADMIN_LOGIN = '/admin/login'

let warnedMissingAllowlist = false

function ensureCsrfCookie(request: NextRequest, response: NextResponse): void {
  if (!request.cookies.get(ADMIN_CSRF_COOKIE)?.value) {
    response.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  }
}

function forbidden(message: string): NextResponse {
  const res = NextResponse.json({ error: message }, { status: 403 })
  applySecurityHeaders(res.headers)
  return res
}

/**
 * Security middleware – minden route-on fut.
 * /admin/* (kivéve /admin/login) védve: aláírt admin JWT cookie.
 * /admin és /api/admin/*: IP whitelist (productionben kötelező) + (mutáló API) CSRF.
 */
export async function middleware(request: NextRequest) {
  const host = request.nextUrl.hostname
  if (host === 'gulumen.com') {
    const wwwUrl = request.nextUrl.clone()
    wwwUrl.hostname = 'www.gulumen.com'
    return NextResponse.redirect(wwwUrl, 308)
  }

  const pathname = request.nextUrl.pathname

  if (isAdminIpRestrictedPath(pathname)) {
    const ip = getClientIp(request)
    const ipDecision = evaluateAdminIpAccess(ip)
    if (ipDecision.reason === 'unconfigured' && !warnedMissingAllowlist) {
      warnedMissingAllowlist = true
      console.warn(
        ipDecision.ok
          ? '[admin] ADMIN_ALLOWED_IPS is empty; allowing all IPs outside production. Set office/VPN CIDRs to restrict /admin.'
          : '[admin] ADMIN_ALLOWED_IPS is empty in production; blocking all admin IPs. Set office/VPN addresses or CIDRs.'
      )
    }
    if (!ipDecision.ok) {
      console.warn({ ip, pathname, reason: ipDecision.reason }, '[admin] IP not allowed')
      return forbidden('Forbidden')
    }
  }

  if (isAdminApiPath(pathname)) {
    const csrf = evaluateAdminCsrf(request)
    if (!csrf.ok) {
      console.warn({ pathname, reason: csrf.reason }, '[admin] CSRF check failed')
      return forbidden('Forbidden')
    }
  }

  if (pathname.startsWith(ADMIN_PREFIX) && !pathname.startsWith(ADMIN_LOGIN)) {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const authorized = await verifyAdminSessionToken(token)
    if (!authorized) {
      const loginUrl = new URL(ADMIN_LOGIN, request.url)
      loginUrl.searchParams.set('from', pathname)
      const redirectRes = NextResponse.redirect(loginUrl)
      applySecurityHeaders(redirectRes.headers)
      ensureCsrfCookie(request, redirectRes)
      return redirectRes
    }
  }

  const response = NextResponse.next()
  response.headers.set('x-pathname', request.nextUrl.pathname)
  response.headers.set('x-search', request.nextUrl.search)
  applySecurityHeaders(response.headers)

  if (isAdminIpRestrictedPath(pathname)) {
    ensureCsrfCookie(request, response)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|models/).*)'],
}
