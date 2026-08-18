'use client'

import { useEffect, useState, type FormEvent } from 'react'
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
  NFC_GIFT: 'NFC ajándékpont',
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
  const [nfcEmail, setNfcEmail] = useState('')
  const [nfcPoints, setNfcPoints] = useState('1000')
  const [nfcTagId, setNfcTagId] = useState('')
  const [nfcBusy, setNfcBusy] = useState(false)
  const [nfcMessage, setNfcMessage] = useState<string | null>(null)

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

  const handleNfcGrant = async (e: FormEvent) => {
    e.preventDefault()
    setNfcBusy(true)
    setNfcMessage(null)
    try {
      const res = await fetch('/api/admin/gamification/nfc-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: nfcEmail.trim(),
          points: Number(nfcPoints),
          nfcTagId: nfcTagId.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'NFC jóváírás sikertelen')
      }
      const expires = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('hu-HU') : ''
      setNfcMessage(
        `Jóváírva: ${data.points} pont → ${data.email}${expires ? `, lejár: ${expires}` : ''}`
      )
      setNfcTagId('')
    } catch (err) {
      setNfcMessage(err instanceof Error ? err.message : 'NFC jóváírás sikertelen')
    } finally {
      setNfcBusy(false)
    }
  }

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

      <section className="rounded-xl border border-[var(--border)] bg-background p-5 space-y-3">
        <h2 className="text-lg font-heading font-semibold text-foreground">NFC ajándékpont jóváírás</h2>
        <p className="text-sm text-muted">
          Az NFC-n beolvasott pontok a felhasználó nevére kerülnek, 1 pont = 1 Ft, teljesen
          levásárolhatók a termékárra (szállítás mindig készpénz/kártya), és az aktiválástól 1 hónapig
          érvényesek. Más kuponnal nem kombinálhatók.
        </p>
        <form onSubmit={handleNfcGrant} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-muted mb-1">Felhasználó e-mail</span>
            <input
              type="email"
              required
              value={nfcEmail}
              onChange={(e) => setNfcEmail(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-muted mb-1">Pont (Ft)</span>
            <input
              type="number"
              min={1}
              required
              value={nfcPoints}
              onChange={(e) => setNfcPoints(e.target.value)}
              className="w-28 rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-muted mb-1">NFC azonosító (opcionális)</span>
            <input
              type="text"
              value={nfcTagId}
              onChange={(e) => setNfcTagId(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={nfcBusy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {nfcBusy ? 'Jóváírás…' : 'Pontok jóváírása'}
          </button>
        </form>
        {nfcMessage && <p className="text-sm text-foreground">{nfcMessage}</p>}
      </section>

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
