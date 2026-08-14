'use client'

import {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_REQUESTED_WITH_HEADER,
  ADMIN_REQUESTED_WITH_VALUE,
} from '@/lib/admin-csrf-constants'
import {
  ADMIN_PUBLIC_BASE_COOKIE,
  CANONICAL_ADMIN_API_PREFIX,
  parseAdminPublicBaseCookie,
  publicAdminApiPath,
  slugFromPublicBase,
} from '@/lib/admin-url'

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1))
    }
  }
  return ''
}

function adminSlugFromBrowser(): string | null {
  return slugFromPublicBase(parseAdminPublicBaseCookie(readCookie(ADMIN_PUBLIC_BASE_COOKIE)) ?? '/admin')
}

function resolveAdminApiUrl(input: RequestInfo | URL): { url: URL; isAdminApi: boolean } | null {
  try {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? new URL(raw) : new URL(raw, window.location.origin)
    const slug = adminSlugFromBrowser()
    const isCanonicalAdminApi = url.pathname === CANONICAL_ADMIN_API_PREFIX || url.pathname.startsWith(`${CANONICAL_ADMIN_API_PREFIX}/`)
    const isHiddenAdminApi = Boolean(slug && (url.pathname === `/api/${slug}` || url.pathname.startsWith(`/api/${slug}/`)))
    if (!isCanonicalAdminApi && !isHiddenAdminApi) {
      return { url, isAdminApi: false }
    }
    if (isCanonicalAdminApi && slug) {
      url.pathname = publicAdminApiPath(url.pathname, slug)
    }
    return { url, isAdminApi: true }
  } catch {
    return null
  }
}

function isAdminApiUrl(input: RequestInfo | URL): boolean {
  return resolveAdminApiUrl(input)?.isAdminApi === true
}

function withAdminHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers)
  const token = readCookie(ADMIN_CSRF_COOKIE)
  if (token && !headers.has(ADMIN_CSRF_HEADER)) {
    headers.set(ADMIN_CSRF_HEADER, token)
  }
  if (!headers.has(ADMIN_REQUESTED_WITH_HEADER)) {
    headers.set(ADMIN_REQUESTED_WITH_HEADER, ADMIN_REQUESTED_WITH_VALUE)
  }
  return {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers,
  }
}

function rewriteAdminInput(input: RequestInfo | URL): RequestInfo | URL {
  const resolved = resolveAdminApiUrl(input)
  if (!resolved?.isAdminApi) return input
  if (typeof input === 'string') {
    const original = input.startsWith('http://') || input.startsWith('https://') ? new URL(input) : new URL(input, window.location.origin)
    if (original.pathname === resolved.url.pathname && original.search === resolved.url.search) return input
    return `${resolved.url.pathname}${resolved.url.search}`
  }
  return resolved.url
}

/** Admin API fetch: CSRF header + credentials. */
export function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(rewriteAdminInput(input), withAdminHeaders(init))
}

let installed = false

function installAdminFetchGuard(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (isAdminApiUrl(input)) {
      return originalFetch(rewriteAdminInput(input), withAdminHeaders(init))
    }
    return originalFetch(input, init)
  }
}

installAdminFetchGuard()
