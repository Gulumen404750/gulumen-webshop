'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import '@/lib/admin-fetch'
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton'
import { AdminApprovalAlerts } from '@/components/admin/AdminApprovalAlerts'
import {
  classifyAdminPath,
  isAdminLoginPathname,
  publicAdminUiPathFromBase,
  slugFromPublicBase,
} from '@/lib/admin-url'
import { navPermissionForHref, roleHasPermission, type AdminRole } from '@/lib/admin-rbac'

const nav = [
  { href: '/admin/dashboard', label: 'Áttekintés' },
  { href: '/admin/dashboard/products', label: 'Termékek' },
  { href: '/admin/dashboard/orders', label: 'Rendelések' },
  { href: '/admin/dashboard/coupons', label: 'Kuponok' },
  { href: '/admin/dashboard/abandoned-carts', label: 'Elhagyott kosarak' },
  { href: '/admin/dashboard/gamification', label: 'Gamification' },
  { href: '/admin/dashboard/users', label: 'Felhasználók' },
  { href: '/admin/dashboard/chat', label: 'Chat / AI' },
  { href: '/admin/dashboard/calls', label: 'Hívások' },
  { href: '/admin/dashboard/deal-popup', label: 'Akciós popup' },
  { href: '/admin/dashboard/settings', label: 'Beállítások' },
]

export function AdminShell({
  publicBase,
  children,
}: {
  publicBase: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const slug = slugFromPublicBase(publicBase)
  const match = classifyAdminPath(pathname, slug)
  const internalPath = match.kind === 'ui' ? match.internalPath : pathname
  const isLogin = isAdminLoginPathname(pathname, slug)
  const dashboardHref = publicAdminUiPathFromBase('/admin/dashboard', publicBase)
  const [role, setRole] = useState<AdminRole | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [parkedUsername, setParkedUsername] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (isLogin) return
    let cancelled = false
    fetch('/api/admin/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (typeof data.username === 'string') setUsername(data.username)
        if (data.role === 'owner' || data.role === 'support' || data.role === 'catalog' || data.role === 'viewer') {
          setRole(data.role)
        }
        if (data.hasParkedOwnerSession && typeof data.parkedUsername === 'string') {
          setParkedUsername(data.parkedUsername)
        } else {
          setParkedUsername(null)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isLogin])

  async function restoreOwnerSession() {
    setRestoring(true)
    try {
      const res = await fetch('/api/admin/session/restore', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Visszaállítás sikertelen')
        return
      }
      window.location.href = dashboardHref
    } catch {
      alert('Visszaállítás sikertelen')
    } finally {
      setRestoring(false)
    }
  }

  const visibleNav = useMemo(() => {
    if (!role) return nav
    return nav.filter((item) => {
      const permission = navPermissionForHref(item.href)
      return !permission || roleHasPermission(role, permission)
    })
  }, [role])

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex bg-[var(--card-bg)]">
      <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[#0f1419] text-gray-200 flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <Link href={dashboardHref} className="font-heading font-bold text-lg text-white">
            Gulumen Admin
          </Link>
          {username && (
            <p className="mt-1 text-xs text-gray-400">
              {username}
              {role ? ` · ${role}` : ''}
            </p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {visibleNav.map((item) => {
            const href = publicAdminUiPathFromBase(item.href, publicBase)
            const active =
              internalPath === item.href ||
              pathname === href ||
              (item.href !== '/admin/dashboard' && (internalPath.startsWith(item.href) || pathname.startsWith(href)))
            return (
              <Link
                key={item.href}
                href={href}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent/20 text-accent'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-[var(--border)]">
          <AdminLogoutButton
            loginHref={publicAdminUiPathFromBase('/admin/login', publicBase)}
            dashboardHref={dashboardHref}
            className="block w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white"
          />
          <Link
            href="/"
            className="block px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white"
          >
            ← Webshop
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 text-foreground overflow-auto">
        {parkedUsername && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground flex flex-wrap items-center justify-between gap-3">
            <p>
              Teszt mód: most <strong>{username || 'operátor'}</strong> sessionje aktív.
              Az owner session (<strong>{parkedUsername}</strong>) parkolva van — nem veszett el.
            </p>
            <button
              type="button"
              disabled={restoring}
              onClick={() => void restoreOwnerSession()}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {restoring ? 'Visszaállítás…' : 'Vissza az owner sessionhöz'}
            </button>
          </div>
        )}
        <AdminApprovalAlerts enabled={role === 'owner'} />
        {internalPath !== '/admin/dashboard' && pathname !== dashboardHref && (
          <div className="mb-4">
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)]/30"
            >
              ← Admin (Áttekintés)
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
