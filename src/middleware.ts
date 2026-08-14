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
import {
  ADMIN_PUBLIC_BASE_COOKIE,
  classifyAdminPath,
  decideCanonicalAdminAccess,
  getAdminPublicBaseCookieOptions,
  getAdminUrlSlug,
  publicAdminUiPath,
} from '@/lib/admin-url'

let warnedMissingAllowlist = false
let warnedMissingAdminSlug = false

function ensureCsrfCookie(request: NextRequest, response: NextResponse): void {
  if (!request.cookies.get(ADMIN_CSRF_COOKIE)?.value) {
    response.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
  }
}

function rememberPublicBase(response: NextResponse, slug: string): void {
  response.cookies.set(
    ADMIN_PUBLIC_BASE_COOKIE,
    `/${slug}`,
    getAdminPublicBaseCookieOptions()
  )
}

function forbidden(message: string): NextResponse {
  const res = NextResponse.json({ error: message }, { status: 403 })
  applySecurityHeaders(res.headers)
  return res
}

function obscureNotFound(): NextResponse {
  const res = new NextResponse('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
  applySecurityHeaders(res.headers)
  return res
}

function withAdminHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  applySecurityHeaders(response.headers)
  return response
}

/**
 * Security middleware – minden route-on fut.
 * Rejtett admin: ADMIN_URL_SLUG → /{slug} és /api/{slug}/* ; /admin session nélkül 404.
 * /{slug}/* (kivéve login / reset) védve: aláírt admin JWT cookie.
 * Admin UI/API: IP whitelist + (mutáló API) CSRF.
 */
export async function middleware(request: NextRequest) {
  const host = request.nextUrl.hostname
  if (host === 'gulumen.com') {
    const wwwUrl = request.nextUrl.clone()
    wwwUrl.hostname = 'www.gulumen.com'
    return NextResponse.redirect(wwwUrl, 308)
  }

  const pathname = request.nextUrl.pathname
  const slug = getAdminUrlSlug()
  const adminPath = classifyAdminPath(pathname, slug)

  if (
    process.env.NODE_ENV === 'production' &&
    !slug &&
    !warnedMissingAdminSlug &&
    (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/'))
  ) {
    warnedMissingAdminSlug = true
    console.warn(
      '[admin] ADMIN_URL_SLUG is unset; /admin and /api/admin are guessable. Set a random slug (openssl rand -hex 8).'
    )
  }

  if (adminPath.kind !== 'none' && slug && adminPath.isCanonical) {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const hasSession = await verifyAdminSessionToken(token)
    const hasApiKey = Boolean(request.headers.get('x-admin-key')?.trim())
    const decision = decideCanonicalAdminAccess(adminPath, { slug, hasSession, hasApiKey })
    if (decision === 'hide') return obscureNotFound()
    if (decision === 'redirect-public') {
      const url = request.nextUrl.clone()
      url.pathname = publicAdminUiPath(adminPath.internalPath, slug)
      const redirectRes = NextResponse.redirect(url)
      rememberPublicBase(redirectRes, slug)
      return withAdminHeaders(redirectRes)
    }
  }

  if (isAdminIpRestrictedPath(pathname)) {
    const ip = getClientIp(request)
    const ipDecision = evaluateAdminIpAccess(ip)
    if (ipDecision.reason === 'unconfigured' && !warnedMissingAllowlist) {
      warnedMissingAllowlist = true
      console.warn(
        '[admin] ADMIN_ALLOWED_IPS is empty; allowing all IPs. Set a comma-separated allowlist to restrict admin access.'
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

  if (adminPath.kind === 'ui' && !adminPath.isLogin) {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const authorized = await verifyAdminSessionToken(token)
    if (!authorized) {
      const loginUrl = new URL(publicAdminUiPath('/admin/login', slug), request.url)
      loginUrl.searchParams.set('from', adminPath.publicPath)
      const redirectRes = NextResponse.redirect(loginUrl)
      applySecurityHeaders(redirectRes.headers)
      ensureCsrfCookie(request, redirectRes)
      if (slug) rememberPublicBase(redirectRes, slug)
      return withAdminHeaders(redirectRes)
    }
  }

  if (adminPath.kind !== 'none' && slug && !adminPath.isCanonical) {
    const url = request.nextUrl.clone()
    url.pathname = adminPath.internalPath
    const response = NextResponse.rewrite(url)
    response.headers.set('x-pathname', pathname)
    response.headers.set('x-search', request.nextUrl.search)
    rememberPublicBase(response, slug)
    if (isAdminIpRestrictedPath(pathname)) {
      ensureCsrfCookie(request, response)
    }
    return withAdminHeaders(response)
  }

  const response = NextResponse.next()
  response.headers.set('x-pathname', request.nextUrl.pathname)
  response.headers.set('x-search', request.nextUrl.search)
  applySecurityHeaders(response.headers)

  if (adminPath.kind !== 'none') {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  }

  if (isAdminIpRestrictedPath(pathname)) {
    ensureCsrfCookie(request, response)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|models/).*)'],
}
