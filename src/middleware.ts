import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isValidLocale, type Locale } from '@/i18n/locales'
import {
  getLocaleFromAcceptLanguage,
  localizePath,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  PATHNAME_HEADER,
  shouldSkipLocaleRouting,
  stripLocalePrefix,
  toInternalPath,
} from '@/i18n/routing'

const ADMIN_PREFIX = '/admin'
const ADMIN_LOGIN = '/admin/login'

function applySecurityHeaders(response: NextResponse): NextResponse {
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

function setLocaleCookie(response: NextResponse, locale: string): void {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}

function resolvePreferredLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale
  return getLocaleFromAcceptLanguage(request.headers.get('accept-language'))
}

/**
 * Security + i18n middleware.
 * - Accept-Language / cookie alapján locale prefix
 * - /en/products → belső /termekek rewrite
 * - Régi prefix nélküli URL-ek → locale-specifikus redirect
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith(ADMIN_PREFIX) && !pathname.startsWith(ADMIN_LOGIN)) {
    const authorized = request.cookies.get('admin_authorized')?.value === '1'
    if (!authorized) {
      const loginUrl = new URL(ADMIN_LOGIN, request.url)
      loginUrl.searchParams.set('from', pathname)
      return applySecurityHeaders(NextResponse.redirect(loginUrl))
    }
    return applySecurityHeaders(NextResponse.next())
  }

  if (shouldSkipLocaleRouting(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  const { locale: pathLocale } = stripLocalePrefix(pathname)

  // Van locale prefix → rewrite belső magyar útvonalra
  if (pathLocale) {
    const internal = toInternalPath(pathname)
    const url = request.nextUrl.clone()
    url.pathname = internal

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(LOCALE_HEADER, pathLocale)
    requestHeaders.set(PATHNAME_HEADER, pathname)

    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    })
    setLocaleCookie(response, pathLocale)
    return applySecurityHeaders(response)
  }

  // Nincs locale prefix: irányítsuk a megfelelő nyelvi URL-re
  const preferred = resolvePreferredLocale(request) as Locale
  const target = localizePath(pathname, preferred, request.nextUrl.search)
  const response = NextResponse.redirect(new URL(target, request.url))
  setLocaleCookie(response, preferred)
  return applySecurityHeaders(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|models/).*)'],
}
