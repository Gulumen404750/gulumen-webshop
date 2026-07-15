'use client'

import { useEffect, useState } from 'react'
import { AdminTableSkeleton } from '@/components/AdminTableSkeleton'

type UserRow = {
  id: string
  email: string
  name: string | null
  createdAt: string
  ordersCount: number
}

type UserDetail = {
  user: UserRow
  wallet: {
    balance: number
    lifetimeEarned: number
    lifetimeRedeemed: number
    suspended: boolean
  } | null
  transactions: {
    id: string
    type: string
    delta: number
    balanceAfter: number
    reason: string | null
    createdAt: string
  }[]
  coupons: {
    id: string
    code: string
    active: boolean
    discountType: string
    discountValue: number
    validUntil: string | null
    usedCount: number
    maxUses: number | null
    createdAt: string
  }[]
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

type UserDetailModalProps = {
  userId: string
  onClose: () => void
}

function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/users/${userId}`, { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Betöltési hiba')
        return data as UserDetail
      })
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Betöltési hiba'))
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-detail-title"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id="user-detail-title" className="text-lg font-semibold text-foreground">
            Felhasználó részletei
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground text-xl leading-none"
            aria-label="Bezárás"
          >
            ×
          </button>
        </div>

        {loading && <p className="text-sm text-muted">Betöltés…</p>}

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {detail && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-muted">E-mail</p>
                <p className="font-medium text-foreground">{detail.user.email}</p>
              </div>
              <div>
                <p className="text-muted">Név</p>
                <p className="font-medium text-foreground">{detail.user.name ?? '–'}</p>
              </div>
              <div>
                <p className="text-muted">Regisztráció</p>
                <p className="font-medium text-foreground">
                  {new Date(detail.user.createdAt).toLocaleDateString('hu-HU')}
                </p>
              </div>
              <div>
                <p className="text-muted">Rendelések</p>
                <p className="font-medium text-foreground">{detail.user.ordersCount}</p>
              </div>
            </div>

            <section className="rounded-xl border border-[var(--border)] bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Pontegyenleg</h3>
              {detail.wallet ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <p className="text-muted">Egyenleg</p>
                    <p className="text-2xl font-bold text-foreground">
                      {detail.wallet.balance.toLocaleString('hu-HU')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted">Összes szerzett</p>
                    <p className="font-semibold">{detail.wallet.lifetimeEarned.toLocaleString('hu-HU')}</p>
                  </div>
                  <div>
                    <p className="text-muted">Beváltott</p>
                    <p className="font-semibold">{detail.wallet.lifetimeRedeemed.toLocaleString('hu-HU')}</p>
                  </div>
                  <div>
                    <p className="text-muted">Státusz</p>
                    <p className={detail.wallet.suspended ? 'text-red-600 font-medium' : 'text-muted'}>
                      {detail.wallet.suspended ? 'Felfüggesztve' : 'Aktív'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Nincs pontegyenleg (még nem játszott).</p>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Utolsó 10 ponttranzakció</h3>
              {detail.transactions.length === 0 ? (
                <p className="text-sm text-muted">Nincs tranzakció.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
                      <tr>
                        <th className="p-2 font-medium">Dátum</th>
                        <th className="p-2 font-medium">Típus</th>
                        <th className="p-2 font-medium">Delta</th>
                        <th className="p-2 font-medium">Egyenleg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-[var(--border)]">
                          <td className="p-2 text-muted whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleString('hu-HU')}
                          </td>
                          <td className="p-2">{formatTxType(tx.type)}</td>
                          <td
                            className={`p-2 font-medium ${
                              tx.delta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {formatDelta(tx.delta)}
                          </td>
                          <td className="p-2">{tx.balanceAfter.toLocaleString('hu-HU')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Gamification kuponok</h3>
              {detail.coupons.length === 0 ? (
                <p className="text-sm text-muted">Nincs gamification kupon.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
                      <tr>
                        <th className="p-2 font-medium">Kód</th>
                        <th className="p-2 font-medium">Kedvezmény</th>
                        <th className="p-2 font-medium">Aktív</th>
                        <th className="p-2 font-medium">Lejárat</th>
                        <th className="p-2 font-medium">Felhasználva</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.coupons.map((c) => (
                        <tr key={c.id} className="border-b border-[var(--border)]">
                          <td className="p-2 font-mono text-xs">{c.code}</td>
                          <td className="p-2">
                            {c.discountType === 'fixed'
                              ? `${c.discountValue.toLocaleString('hu-HU')} Ft`
                              : `${c.discountValue}%`}
                          </td>
                          <td className="p-2">{c.active ? 'Igen' : 'Nem'}</td>
                          <td className="p-2 text-muted">
                            {c.validUntil
                              ? new Date(c.validUntil).toLocaleDateString('hu-HU')
                              : '–'}
                          </td>
                          <td className="p-2">
                            {c.usedCount}
                            {c.maxUses != null ? ` / ${c.maxUses}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/users', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Betöltési hiba')
        return data
      })
      .then((data) => setUsers(data.users ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Betöltési hiba'))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
        <p className="font-medium">Hiba: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Felhasználók</h1>
      <p className="text-sm text-muted">Kattints egy sorra a részletekért.</p>

      {loading ? (
        <AdminTableSkeleton columns={4} rows={10} />
      ) : (
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
                <tr
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="border-b border-[var(--border)] hover:bg-[var(--border)]/20 cursor-pointer"
                >
                  <td className="p-3 font-medium">{u.email}</td>
                  <td className="p-3">{u.name ?? '–'}</td>
                  <td className="p-3 text-muted">
                    {new Date(u.createdAt).toLocaleDateString('hu-HU')}
                  </td>
                  <td className="p-3">{u.ordersCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && users.length === 0 && <p className="text-muted">Nincs felhasználó.</p>}

      {selectedUserId && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  )
}
