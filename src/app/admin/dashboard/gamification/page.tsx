'use client'

import { useEffect, useState } from 'react'
import { AdminTableSkeleton } from '@/components/AdminTableSkeleton'

type GamificationStats = {
  totalPointsDistributed: number
  activeGamificationCoupons: number
  luckySpinsCount: number
}

type TopUser = {
  userId: string
  email: string
  name: string | null
  balance: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  suspended: boolean
}

type PointTx = {
  id: string
  userId: string
  email: string
  type: string
  delta: number
  balanceAfter: number
  reason: string | null
  createdAt: string
}

const TX_TYPE_LABELS: Record<string, string> = {
  BROWSE_5MIN: 'Böngészés',
  LIKE_DAILY_BONUS: 'Kedvenc bónusz',
  REDEEM_COUPON: 'Kupon beváltás',
  PURCHASE_REDEEM: 'Vásárlás (pont)',
  LUCKY_SPIN_BONUS: 'Szerencsekerék',
  REVERSAL: 'Visszavonás',
  ADMIN_ADJUST: 'Admin módosítás',
}

function formatTxType(type: string): string {
  return TX_TYPE_LABELS[type] ?? type
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta.toLocaleString('hu-HU')}` : delta.toLocaleString('hu-HU')
}

export default function AdminGamificationPage() {
  const [stats, setStats] = useState<GamificationStats | null>(null)
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [transactions, setTransactions] = useState<PointTx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/gamification')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Betöltési hiba')
        return data
      })
      .then((data) => {
        setStats(data.stats)
        setTopUsers(data.topUsers ?? [])
        setTransactions(data.transactions ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Betöltési hiba'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-heading font-bold text-foreground">Gamification</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] bg-background p-5 h-24 animate-pulse bg-[var(--border)]/20"
            />
          ))}
        </div>
        <AdminTableSkeleton columns={4} rows={10} />
        <AdminTableSkeleton columns={7} rows={10} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-red-700 dark:text-red-400">
        <p className="font-medium">Hiba: {error}</p>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Összes kiosztott pont',
      value: (stats?.totalPointsDistributed ?? 0).toLocaleString('hu-HU'),
    },
    {
      label: 'Aktív gamification kuponok',
      value: (stats?.activeGamificationCoupons ?? 0).toLocaleString('hu-HU'),
    },
    {
      label: 'Szerencsekerék pörgetések',
      value: (stats?.luckySpinsCount ?? 0).toLocaleString('hu-HU'),
    },
    {
      label: 'Top user egyenleg',
      value: topUsers[0] ? topUsers[0].balance.toLocaleString('hu-HU') : '0',
      hint: topUsers[0]?.email,
    },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-heading font-bold text-foreground">Gamification</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[var(--border)] bg-background p-5"
          >
            <p className="text-sm font-medium text-muted">{card.label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{card.value}</p>
            {'hint' in card && card.hint && (
              <p className="text-xs text-muted mt-1 truncate" title={card.hint}>
                {card.hint}
              </p>
            )}
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          Top 10 felhasználó (pontegyenleg)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">E-mail</th>
                <th className="p-3 font-medium">Egyenleg</th>
                <th className="p-3 font-medium">Összes szerzett</th>
                <th className="p-3 font-medium">Beváltott</th>
                <th className="p-3 font-medium">Státusz</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((user, index) => (
                <tr
                  key={user.userId}
                  className="border-b border-[var(--border)] hover:bg-[var(--border)]/20"
                >
                  <td className="p-3 text-muted">{index + 1}</td>
                  <td className="p-3">
                    <span className="block">{user.email}</span>
                    {user.name && <span className="text-xs text-muted">{user.name}</span>}
                  </td>
                  <td className="p-3 font-semibold">{user.balance.toLocaleString('hu-HU')}</td>
                  <td className="p-3">{user.lifetimeEarned.toLocaleString('hu-HU')}</td>
                  <td className="p-3">{user.lifetimeRedeemed.toLocaleString('hu-HU')}</td>
                  <td className="p-3">
                    {user.suspended ? (
                      <span className="text-red-600 dark:text-red-400">Felfüggesztve</span>
                    ) : (
                      <span className="text-muted">Aktív</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {topUsers.length === 0 && <p className="text-muted">Nincs pontegyenleg adat.</p>}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          Utolsó 50 ponttranzakció
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 font-medium">Dátum</th>
                <th className="p-3 font-medium">E-mail</th>
                <th className="p-3 font-medium">Típus</th>
                <th className="p-3 font-medium">Delta</th>
                <th className="p-3 font-medium">Egyenleg után</th>
                <th className="p-3 font-medium">Megjegyzés</th>
                <th className="p-3 font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--border)]/20"
                >
                  <td className="p-3 text-muted whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleString('hu-HU')}
                  </td>
                  <td className="p-3">{tx.email}</td>
                  <td className="p-3">{formatTxType(tx.type)}</td>
                  <td
                    className={`p-3 font-medium ${
                      tx.delta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatDelta(tx.delta)}
                  </td>
                  <td className="p-3">{tx.balanceAfter.toLocaleString('hu-HU')}</td>
                  <td className="p-3 text-muted max-w-[200px] truncate" title={tx.reason ?? undefined}>
                    {tx.reason ?? '–'}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted">{tx.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transactions.length === 0 && <p className="text-muted">Nincs tranzakció.</p>}
      </section>
    </div>
  )
}
