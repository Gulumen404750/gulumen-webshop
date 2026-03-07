import Link from 'next/link'
import { prisma, isDbConfigured } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  if (!isDbConfigured()) {
    return (
      <p className="text-muted">Adatbázis nincs konfigurálva.</p>
    )
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      _count: { select: { orders: true } },
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Felhasználók</h1>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
            <tr>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Név</th>
              <th className="p-3 font-medium">Regisztráció</th>
              <th className="p-3 font-medium">Rendelések</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/20">
                <td className="p-3 font-medium">{u.email}</td>
                <td className="p-3">{u.name ?? '–'}</td>
                <td className="p-3 text-muted">{u.createdAt.toLocaleDateString('hu-HU')}</td>
                <td className="p-3">{u._count.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <p className="text-muted">Nincs felhasználó.</p>}
    </div>
  )
}
