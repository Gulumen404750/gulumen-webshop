/**
 * Admin IP whitelist – ADMIN_ALLOWED_IPS (vesszővel elválasztott IPv4/IPv6 / CIDR).
 * Production: üres lista = tiltás (403) a teljes admin felületen, beleértve a rejtett
 * ADMIN_URL_SLUG útvonalakat. Dev/test: üres lista = átengedés.
 * Explicit `*` = minden IP (csak tudatos kivétel, ne használd élesben).
 */

import { normalizeIp } from '@/lib/request-ip'
import { isAdminSurfacePath } from '@/lib/admin-url'

export type AdminIpDecision =
  | { ok: true; reason: 'allowed' | 'unconfigured' }
  | { ok: false; reason: 'denied' | 'unconfigured' }

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const v = Number(part)
    if (v < 0 || v > 255) return null
    n = (n << 8) + v
  }
  return n >>> 0
}

function matchIpv4Cidr(ip: string, cidr: string): boolean {
  const slash = cidr.lastIndexOf('/')
  if (slash < 0) return false
  const base = cidr.slice(0, slash)
  const bits = Number(cidr.slice(slash + 1))
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const ipN = ipv4ToInt(ip)
  const baseN = ipv4ToInt(normalizeIp(base))
  if (ipN === null || baseN === null) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ipN & mask) === (baseN & mask)
}

export function parseAdminAllowedIps(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isIpAllowed(ip: string, allowlist: string[]): boolean {
  if (allowlist.some((entry) => entry === '*')) return true
  const normalized = normalizeIp(ip)
  if (!normalized || normalized === 'unknown') return false

  for (const entry of allowlist) {
    const item = entry.trim()
    if (!item) continue
    if (item === '*') return true
    if (item.includes('/')) {
      if (matchIpv4Cidr(normalized, item.toLowerCase())) return true
      continue
    }
    if (normalizeIp(item) === normalized) return true
  }
  return false
}

export function evaluateAdminIpAccess(
  ip: string,
  env: { NODE_ENV?: string; ADMIN_ALLOWED_IPS?: string } = process.env
): AdminIpDecision {
  const allowlist = parseAdminAllowedIps(env.ADMIN_ALLOWED_IPS)
  if (allowlist.length === 0) {
    if (env.NODE_ENV === 'production') {
      return { ok: false, reason: 'unconfigured' }
    }
    return { ok: true, reason: 'unconfigured' }
  }
  if (isIpAllowed(ip, allowlist)) return { ok: true, reason: 'allowed' }
  return { ok: false, reason: 'denied' }
}

export function isAdminIpRestrictedPath(pathname: string): boolean {
  return isAdminSurfacePath(pathname)
}
