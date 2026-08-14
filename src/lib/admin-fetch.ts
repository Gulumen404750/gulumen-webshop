'use client'

import {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_REQUESTED_WITH_HEADER,
  ADMIN_REQUESTED_WITH_VALUE,
} from '@/lib/admin-csrf-constants'

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

function isAdminApiUrl(input: RequestInfo | URL): boolean {
  try {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? new URL(raw) : new URL(raw, window.location.origin)
    return url.pathname.startsWith('/api/admin/')
  } catch {
    return false
  }
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

/** Admin API fetch: CSRF header + credentials. */
export function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, withAdminHeaders(init))
}

let installed = false

function installAdminFetchGuard(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (isAdminApiUrl(input)) {
      return originalFetch(input, withAdminHeaders(init))
    }
    return originalFetch(input, init)
  }
}

installAdminFetchGuard()
