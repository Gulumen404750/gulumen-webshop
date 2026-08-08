'use client'

import { useEffect, useMemo, useState } from 'react'
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

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function formatTxType(type: string): string {
  return TX_TYPE_LABELS[type] ?? type
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta.toLocaleString('hu-HU')}` : delta.toLocaleString('hu-HU')
}

function userStartsWithLetter(user: UserRow, letter: string): boolean {
  const L = letter.toUpperCase()
  const name = user.name?.trim() ?? ''
  const email = user.email.trim()
  const nameInitial = name.charAt(0).toUpperCase()
  const emailInitial = email.charAt(0).toUpperCase()
  return nameInitial === L || emailInitial === L
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

type BulkEmailModalProps = {
  selectedCount: number
  onClose: () => void
  onSend: (subject: string, body: string) => Promise<void>
  sending: boolean
}

function BulkEmailModal({ selectedCount, onClose, onSend, sending }: BulkEmailModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-email-title"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="bulk-email-title" className="text-lg font-semibold text-foreground">
            E-mail küldése ({selectedCount} címzett)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground text-xl leading-none"
            aria-label="Bezárás"
            disabled={sending}
          >
            ×
          </button>
        </div>

        <label className="block text-sm">
          <span className="font-medium mb-1 block">Tárgy</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            placeholder="pl. Üzenet a Gulumen-től"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium mb-1 block">Üzenet</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={sending}
            rows={8}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground resize-y"
            placeholder="Alap rendszerüzenet a kijelölt felhasználóknak…"
          />
        </label>

        <p className="text-xs text-muted">
          A címzettek e-mail címére megy. A név alapján automatikus köszönés kerül az elejére.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)]/30 disabled:opacity-50"
          >
            Mégse
          </button>
          <button
            type="button"
            disabled={sending || !subject.trim() || !body.trim()}
            onClick={() => onSend(subject.trim(), body.trim())}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {sending ? 'Küldés…' : 'Küldés'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [letterFilter, setLetterFilter] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

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

  const allSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id))
  const selectedCount = selectedIds.size

  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const L of LETTERS) counts[L] = 0
    for (const u of users) {
      for (const L of LETTERS) {
        if (userStartsWithLetter(u, L)) counts[L] += 1
      }
    }
    return counts
  }, [users])

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(users.map((u) => u.id)))
    setLetterFilter('')
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setLetterFilter('')
  }

  const selectByLetter = (letter: string) => {
    const L = letter.toUpperCase()
    setLetterFilter(L)
    setSelectedIds(new Set(users.filter((u) => userStartsWithLetter(u, L)).map((u) => u.id)))
  }

  const sendBulkEmail = async (subject: string, body: string) => {
    setSending(true)
    setToast(null)
    try {
      const res = await fetch('/api/admin/users/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [...selectedIds],
          subject,
          body,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Küldési hiba')
      setToast({
        type: data.failed > 0 ? 'error' : 'ok',
        text:
          data.failed > 0
            ? `Elküldve: ${data.sent}, sikertelen: ${data.failed}`
            : `E-mail elküldve ${data.sent} címzettnek.`,
      })
      setEmailOpen(false)
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Küldési hiba' })
    } finally {
      setSending(false)
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
        <p className="font-medium">Hiba: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Felhasználók</h1>
          <p className="text-sm text-muted mt-1">
            Pipáld ki a címzetteket, vagy jelöld ki az összeset / egy kezdőbetűt (pl. S), majd küldj
            e-mailt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={selectAll}
            disabled={loading || users.length === 0}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]/30 disabled:opacity-50"
          >
            Összes kijelölése
          </button>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-muted whitespace-nowrap">Csak betű:</span>
            <select
              value={letterFilter}
              onChange={(e) => {
                const v = e.target.value
                if (!v) clearSelection()
                else selectByLetter(v)
              }}
              disabled={loading || users.length === 0}
              className="rounded-lg border border-[var(--border)] bg-background px-2 py-1.5 text-sm min-w-[4.5rem]"
              aria-label="Kijelölés kezdőbetű szerint"
            >
              <option value="">—</option>
              {LETTERS.map((L) => (
                <option key={L} value={L} disabled={(letterCounts[L] ?? 0) === 0}>
                  {L} ({letterCounts[L] ?? 0})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedCount === 0}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]/30 disabled:opacity-50"
          >
            Törlés
          </button>
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            disabled={selectedCount === 0}
            className="rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            E-mail küldése ({selectedCount})
          </button>
        </div>
      </div>

      {toast && (
        <p
          className={`text-sm rounded-lg border px-3 py-2 ${
            toast.type === 'ok'
              ? 'border-green-600/30 bg-green-600/10 text-green-800 dark:text-green-300'
              : 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-300'
          }`}
        >
          {toast.text}
        </p>
      )}

      {loading ? (
        <AdminTableSkeleton columns={5} rows={10} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => (allSelected ? clearSelection() : selectAll())}
                    aria-label="Összes kijelölése"
                    className="rounded border-[var(--border)]"
                  />
                </th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Név</th>
                <th className="p-3 font-medium">Regisztráció</th>
                <th className="p-3 font-medium">Rendelések</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const checked = selectedIds.has(u.id)
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-[var(--border)] hover:bg-[var(--border)]/20 ${
                      checked ? 'bg-accent/5' : ''
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(u.id)}
                        aria-label={`Kijelölés: ${u.email}`}
                        className="rounded border-[var(--border)]"
                      />
                    </td>
                    <td
                      className="p-3 font-medium cursor-pointer"
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      {u.email}
                    </td>
                    <td
                      className="p-3 cursor-pointer"
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      {u.name ?? '–'}
                    </td>
                    <td
                      className="p-3 text-muted cursor-pointer"
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      {new Date(u.createdAt).toLocaleDateString('hu-HU')}
                    </td>
                    <td
                      className="p-3 cursor-pointer"
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      {u.ordersCount}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && users.length === 0 && <p className="text-muted">Nincs felhasználó.</p>}

      {selectedUserId && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}

      {emailOpen && (
        <BulkEmailModal
          selectedCount={selectedCount}
          onClose={() => !sending && setEmailOpen(false)}
          onSend={sendBulkEmail}
          sending={sending}
        />
      )}
    </div>
  )
}
