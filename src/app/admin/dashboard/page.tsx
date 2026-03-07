import Link from 'next/link'
import { prisma, isDbConfigured } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  if (!isDbConfigured()) {
    return (
      <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
        <p className="font-medium">Adatbázis nincs konfigurálva.</p>
        <p className="text-sm mt-1">Állítsd be a DATABASE_URL-t a teljes admin és termékkezeléshez.</p>
      </div>
    )
  }

  const [
    productsCount,
    ordersCount,
    pendingCallbacks,
    todayCallsCount,
    usersCount,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.callbackRequest.count({ where: { status: 'pending' } }),
    prisma.call.count({
      where: {
        timestamp: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.user.count(),
  ])

  const cards = [
    { label: 'Termékek', value: productsCount, href: '/admin/dashboard/products' },
    { label: 'Rendelések', value: ordersCount, href: '/admin/dashboard/orders' },
    { label: 'Visszahívás függőben', value: pendingCallbacks, href: '/admin/dashboard/calls' },
    { label: 'Mai hívások', value: todayCallsCount, href: '/admin/dashboard/calls' },
    { label: 'Felhasználók', value: usersCount, href: '/admin/dashboard/users' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-heading font-bold text-foreground">Áttekintés</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-[var(--border)] bg-background p-5 hover:border-accent/50 transition-colors"
          >
            <p className="text-sm font-medium text-muted">{c.label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{c.value}</p>
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted">
        A bal oldali menüből választhatod a kezelendő részt. A termékek és rendelések adatbázisból jönnek.
      </p>
    </div>
  )
}
