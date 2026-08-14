'use client'

import {
  ADMIN_PUBLIC_BASE_COOKIE,
  CANONICAL_ADMIN_UI_PREFIX,
  parseAdminPublicBaseCookie,
  publicAdminUiPathFromBase,
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

/** Böngészőben a rejtett admin előtag (`/{slug}`), különben `/admin`. */
export function readAdminPublicBase(): string {
  return parseAdminPublicBaseCookie(readCookie(ADMIN_PUBLIC_BASE_COOKIE)) ?? CANONICAL_ADMIN_UI_PREFIX
}

export function adminPageHref(canonicalAdminPath: string): string {
  return publicAdminUiPathFromBase(canonicalAdminPath, readAdminPublicBase())
}
