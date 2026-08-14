'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import '@/lib/admin-fetch'
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton'
import { isPublicAdminUiPath } from '@/lib/admin-session-constants'

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isPublic = isPublicAdminUiPath(pathname)

  if (isPublic) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex bg-[var(--card-bg)]">
      <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[#0f1419] text-gray-200 flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <Link href="/admin/dashboard" className="font-heading font-bold text-lg text-white">
            Gulumen Admin
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((item) => {
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
