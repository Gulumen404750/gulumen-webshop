'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type PromoUser = {
  userId: string
  email: string
  name: string | null
  registeredAt: string
  catStatus: 'claimed' | 'used' | null
  catClaimedAt: string | null
  catUsedAt: string | null
  registrationStatus: 'claimed' | 'used' | null
  registrationClaimedAt: string | null
  registrationUsedAt: string | null
}

type Filter = 'all' | 'with_coupon' | 'registration' | 'cat'

function statusBadge(status: 'claimed' | 'used' | null) {
  if (!status) {
    return (
      <span className="text-xs text-muted">—</span>
    )
  }
  if (status === 'claimed') {
    return (
      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-green-600/15 text-green-700 dark:text-green-400">
        Aktív
      </span>
    )
  }
  return (
    <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--border)] text-muted">
      Felhasználva
    </span>
  )
}

function formatDt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminPromoCouponsSection() {
  const [users, setUsers] = useState<PromoUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('with_coupon')
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/admin/promo-coupons', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Betöltési hiba')
        return data as { users: PromoUser[] }
      })
      .then((data) => setUsers(data.users ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Betöltési hiba'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter === 'with_coupon' && !u.catStatus && !u.registrationStatus) return false
      if (filter === 'registration' && !u.registrationStatus) return false
      if (filter === 'cat' && !u.catStatus) return false
      if (q && !u.email.toLowerCase().includes(q) && !(u.name ?? '').toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [users, filter, search])

  const stats = useMemo(() => {
    const regActive = users.filter((u) => u.registrationStatus === 'claimed').length
    const regUsed = users.filter((u) => u.registrationStatus === 'used').length
    const catActive = users.filter((u) => u.catStatus === 'claimed').length
    const catUsed = users.filter((u) => u.catStatus === 'used').length
    return { regActive, regUsed, catActive, catUsed }
  }, [users])

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-4">
      <div>
        <h2 className="font-heading font-semibold text-foreground">Regisztrációs és macska kuponok</h2>
        <p className="text-sm text-muted mt-1 leading-tight">
          Minden regisztrált felhasználó 5%-os (macska) és 10%-os (regisztráció + ajánlat elfogadás) kupon
          állapota. A kuponok nem vonhatók össze, a legnagyobb beváltható kedvezmény 15%. Csak a szerveren
          naplózott aktiválások jelennek meg (régi localStorage-only claimek nem).
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-muted text-xs">10% reg. aktív</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{stats.regActive}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-muted text-xs">10% reg. felhasználva</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{stats.regUsed}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-muted text-xs">5% macska aktív</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{stats.catActive}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-muted text-xs">5% macska felhasználva</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{stats.catUsed}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Keresés e-mail / név…"
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground min-w-[200px]"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="with_coupon">Csak kuponos felhasználók</option>
          <option value="all">Minden regisztrált</option>
          <option value="registration">10% regisztrációs</option>
          <option value="cat">5% macska</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="text-sm text-accent hover:underline"
        >
          Frissítés
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Betöltés…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 font-medium">E-mail</th>
                <th className="p-3 font-medium">Név</th>
                <th className="p-3 font-medium">Regisztráció</th>
                <th className="p-3 font-medium">10% reg.</th>
                <th className="p-3 font-medium">Aktiválva</th>
                <th className="p-3 font-medium">5% macska</th>
                <th className="p-3 font-medium">Aktiválva</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.userId} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--border)]/20">
                  <td className="p-3 font-medium text-foreground">{u.email}</td>
                  <td className="p-3 text-muted">{u.name ?? '—'}</td>
                  <td className="p-3 text-muted whitespace-nowrap">{formatDt(u.registeredAt)}</td>
                  <td className="p-3">{statusBadge(u.registrationStatus)}</td>
                  <td className="p-3 text-muted text-xs whitespace-nowrap">
                    {formatDt(u.registrationClaimedAt)}
                    {u.registrationUsedAt && (
                      <span className="block text-muted">Haszn: {formatDt(u.registrationUsedAt)}</span>
                    )}
                  </td>
                  <td className="p-3">{statusBadge(u.catStatus)}</td>
                  <td className="p-3 text-muted text-xs whitespace-nowrap">
                    {formatDt(u.catClaimedAt)}
                    {u.catUsedAt && (
                      <span className="block text-muted">Haszn: {formatDt(u.catUsedAt)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted">Nincs megjeleníthető felhasználó ebben a szűrésben.</p>
      )}
    </section>
  )
}
