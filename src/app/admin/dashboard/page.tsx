import Link from 'next/link'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { getAdminActor } from '@/lib/admin-auth'
import { roleHasPermission } from '@/lib/admin-rbac'

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
    lowStockCount,
    topViewed,
    actorRow,
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
    prisma.product.count({
      where: { stock: { lt: 3 }, active: true },
    }),
    prisma.product.findMany({
      where: { archived: false },
      orderBy: [{ viewsCount: 'desc' }, { updatedAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        viewsCount: true,
        active: true,
      },
    }),
    getAdminActor(),
  ])

  const actor = actorRow
  const cards = [
    { label: 'Termékek', value: productsCount, href: '/admin/dashboard/products', permission: 'products:read' as const },
    { label: 'Rendelések', value: ordersCount, href: '/admin/dashboard/orders', permission: 'orders:read' as const },
    { label: 'Visszahívás függőben', value: pendingCallbacks, href: '/admin/dashboard/calls', permission: 'support:write' as const },
    { label: 'Mai hívások', value: todayCallsCount, href: '/admin/dashboard/calls', permission: 'support:write' as const },
    { label: 'Felhasználók', value: usersCount, href: '/admin/dashboard/users', permission: 'customers:pii' as const },
  ].filter((c) => actor && roleHasPermission(actor.role, c.permission))

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-heading font-bold text-foreground">Áttekintés</h1>

      {lowStockCount > 0 && (
        <Link
          href="/admin/dashboard/products?lowStock=1"
          className="block rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 hover:border-amber-500/70 transition-colors"
        >
          <p className="font-medium text-amber-800 dark:text-amber-300">
            {lowStockCount} termék készlete 3 alatt
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            Megtekintés a terméklistán →
          </p>
        </Link>
      )}

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

      <section className="rounded-xl border border-[var(--border)] bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-heading font-semibold text-foreground">
              Top 5 legnépszerűbb termék
            </h2>
            <p className="text-sm text-muted mt-0.5">
              A legtöbbet megtekintett / kattintott termékek
            </p>
          </div>
          <Link
            href="/admin/dashboard/products?sort=popular"
            className="text-sm text-accent hover:underline"
          >
            Összes népszerű →
          </Link>
        </div>
        {topViewed.length === 0 ? (
          <p className="text-sm text-muted">Még nincs megtekintési adat.</p>
        ) : (
          <ol className="space-y-2">
            {topViewed.map((p, index) => (
              <li key={p.id}>
                <Link
                  href={`/admin/dashboard/products/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 hover:border-accent/40 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="text-muted mr-2">{index + 1}.</span>
                    <span className="font-medium text-foreground">{p.name}</span>
                    {!p.active && (
                      <span className="ml-2 text-xs text-amber-600">inaktív</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                    {p.viewsCount.toLocaleString('hu-HU')} megtekintés
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-sm text-muted">
        A bal oldali menüből választhatod a kezelendő részt. A termékek és rendelések adatbázisból jönnek.
      </p>
    </div>
  )
}
