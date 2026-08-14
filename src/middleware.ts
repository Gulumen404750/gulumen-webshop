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
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  CSP_NONCE_HEADER,
  generateCspNonce,
} from '@/lib/admin-security-headers'
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

function isDevEnv(): boolean {
  return process.env.NODE_ENV !== 'production'
}

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

function requestHeadersWithNonce(request: NextRequest, nonce: string, pathname: string): Headers {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(CSP_NONCE_HEADER, nonce)
  requestHeaders.set('x-pathname', pathname)
  requestHeaders.set('x-search', request.nextUrl.search)
  requestHeaders.set('Content-Security-Policy', buildContentSecurityPolicy(isDevEnv(), nonce))
  return requestHeaders
}

function applyNonceSecurity(headers: Headers, nonce: string): void {
  applySecurityHeaders(headers, isDevEnv(), nonce)
}

function forbidden(message: string, nonce: string): NextResponse {
  const res = NextResponse.json({ error: message }, { status: 403 })
  applyNonceSecurity(res.headers, nonce)
  return res
}

function obscureNotFound(nonce: string): NextResponse {
  const res = new NextResponse('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
  applyNonceSecurity(res.headers, nonce)
  return res
}

function withAdminHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  applyNonceSecurity(response.headers, nonce)
  return response
}

/**
 * Security middleware – minden route-on fut.
 * Rejtett admin: ADMIN_URL_SLUG → /{slug} és /api/{slug}/* ; /admin session nélkül 404.
 * /{slug}/* (kivéve login) védve: aláírt admin JWT cookie.
 * Admin UI/API: IP whitelist + (mutáló API) CSRF.
 * Production CSP: per-request nonce a kérésen (Next.js scriptek) és a válaszon.
 */
export async function middleware(request: NextRequest) {
  const host = request.nextUrl.hostname
  if (host === 'gulumen.com') {
    const wwwUrl = request.nextUrl.clone()
    wwwUrl.hostname = 'www.gulumen.com'
    return NextResponse.redirect(wwwUrl, 308)
  }

  const nonce = generateCspNonce()
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
    if (decision === 'hide') return obscureNotFound(nonce)
    if (decision === 'redirect-public') {
      const url = request.nextUrl.clone()
      url.pathname = publicAdminUiPath(adminPath.internalPath, slug)
      const redirectRes = NextResponse.redirect(url)
      rememberPublicBase(redirectRes, slug)
      return withAdminHeaders(redirectRes, nonce)
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
      return forbidden('Forbidden', nonce)
    }
  }

  if (isAdminApiPath(pathname)) {
    const csrf = evaluateAdminCsrf(request)
    if (!csrf.ok) {
      console.warn({ pathname, reason: csrf.reason }, '[admin] CSRF check failed')
      return forbidden('Forbidden', nonce)
    }
  }

  if (adminPath.kind === 'ui' && !adminPath.isLogin) {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const authorized = await verifyAdminSessionToken(token)
    if (!authorized) {
      const loginUrl = new URL(publicAdminUiPath('/admin/login', slug), request.url)
      // Relatív admin path – a login oldalon safeAdminReturnPath allowlisteli (nincs open redirect).
      loginUrl.searchParams.set('from', adminPath.publicPath)
      const redirectRes = NextResponse.redirect(loginUrl)
      ensureCsrfCookie(request, redirectRes)
      if (slug) rememberPublicBase(redirectRes, slug)
      return withAdminHeaders(redirectRes, nonce)
    }
  }

  if (adminPath.kind !== 'none' && slug && !adminPath.isCanonical) {
    const url = request.nextUrl.clone()
    url.pathname = adminPath.internalPath
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeadersWithNonce(request, nonce, pathname) },
    })
    response.headers.set('x-pathname', pathname)
    response.headers.set('x-search', request.nextUrl.search)
    rememberPublicBase(response, slug)
    if (isAdminIpRestrictedPath(pathname)) {
      ensureCsrfCookie(request, response)
    }
    return withAdminHeaders(response, nonce)
  }

  const response = NextResponse.next({
    request: { headers: requestHeadersWithNonce(request, nonce, request.nextUrl.pathname) },
  })
  response.headers.set('x-pathname', request.nextUrl.pathname)
  response.headers.set('x-search', request.nextUrl.search)
  applyNonceSecurity(response.headers, nonce)

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
