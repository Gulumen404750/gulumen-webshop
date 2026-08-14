'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import '@/lib/admin-fetch'
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton'
import { type AdminPermission, roleHasPermission, type AdminRole } from '@/lib/admin-rbac'

const nav: Array<{ href: string; label: string; permission: AdminPermission }> = [
  { href: '/admin/dashboard', label: 'Áttekintés', permission: 'dashboard:read' },
  { href: '/admin/dashboard/products', label: 'Termékek', permission: 'products:read' },
  { href: '/admin/dashboard/orders', label: 'Rendelések', permission: 'orders:read' },
  { href: '/admin/dashboard/coupons', label: 'Kuponok', permission: 'coupons:write' },
  { href: '/admin/dashboard/abandoned-carts', label: 'Elhagyott kosarak', permission: 'customers:pii' },
  { href: '/admin/dashboard/gamification', label: 'Gamification', permission: 'coupons:write' },
  { href: '/admin/dashboard/users', label: 'Felhasználók', permission: 'customers:pii' },
  { href: '/admin/dashboard/chat', label: 'Chat / AI', permission: 'support:write' },
  { href: '/admin/dashboard/calls', label: 'Hívások', permission: 'support:write' },
  { href: '/admin/dashboard/deal-popup', label: 'Akciós popup', permission: 'settings:write' },
  { href: '/admin/dashboard/settings', label: 'Beállítások', permission: 'settings:write' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLogin = pathname === '/admin/login'
  const [role, setRole] = useState<AdminRole | null>(null)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    if (isLogin) return
    void fetch('/api/admin/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setRole(data.role)
        if (data?.username) setUsername(data.username)
      })
      .catch(() => {})
  }, [isLogin])

  if (isLogin) {
    return <>{children}</>
  }

  const visibleNav = nav.filter((item) => !role || roleHasPermission(role, item.permission))

  return (
    <div className="min-h-screen flex bg-[var(--card-bg)]">
      <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[#0f1419] text-gray-200 flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <Link href="/admin/dashboard" className="font-heading font-bold text-lg text-white">
            Gulumen Admin
          </Link>
          {username && (
            <p className="text-xs text-gray-400 mt-1">
              {username} · {role}
            </p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
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
          <AdminLogoutButton className="block w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white" />
          <Link
            href="/"
            className="block px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white"
          >
            ← Webshop
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 text-foreground overflow-auto">
        {pathname !== '/admin/dashboard' && (
          <div className="mb-4">
            <Link
              href="/admin/dashboard"
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
