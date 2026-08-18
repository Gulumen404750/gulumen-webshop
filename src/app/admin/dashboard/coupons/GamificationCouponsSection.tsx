'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type CouponStatus = 'active' | 'used' | 'expired' | 'inactive'

type GamificationCoupon = {
  id: string
  code: string
  discountPercent: number
  userId: string | null
  email: string | null
  name: string | null
  status: CouponStatus
  usedCount: number
  maxUses: number | null
  pointsSpent: number | null
  createdAt: string
  validFrom: string | null
  validUntil: string | null
}

type Filter = 'all' | 'active' | 'used' | 'expired' | 'inactive'

function statusBadge(status: CouponStatus) {
  if (status === 'active') {
    return (
      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-green-600/15 text-green-700 dark:text-green-400">
        Aktív
      </span>
    )
  }
  if (status === 'used') {
    return (
      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--border)] text-muted">
        Felhasználva
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-amber-600/15 text-amber-700 dark:text-amber-400">
        Lejárt
      </span>
    )
  }
  return (
    <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--border)] text-muted">
      Inaktív
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

export function AdminGamificationCouponsSection() {
  const [coupons, setCoupons] = useState<GamificationCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/admin/gamification-coupons', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Betöltési hiba')
        return data as { coupons: GamificationCoupon[] }
      })
      .then((data) => setCoupons(data.coupons ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Betöltési hiba'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return coupons.filter((c) => {
      if (filter !== 'all' && c.status !== filter) return false
      if (!q) return true
      const hay = `${c.email ?? ''} ${c.name ?? ''} ${c.code}`.toLowerCase()
      return hay.includes(q)
    })
  }, [coupons, filter, search])

  const stats = useMemo(() => {
    return {
      total: coupons.length,
      active: coupons.filter((c) => c.status === 'active').length,
      used: coupons.filter((c) => c.status === 'used').length,
      expired: coupons.filter((c) => c.status === 'expired').length,
    }
  }, [coupons])

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-4">
      <div>
        <h2 className="font-heading font-semibold text-foreground">Pontból váltott 10%-os kuponok</h2>
        <p className="text-sm text-muted mt-1 leading-tight">
          Aktivitási pontokból beváltott személyes kuponok (GLM-kód, jellemzően 10%, 350–400 pont).
          Egy felhasználónak egyszerre egy aktív gamification kuponja lehet.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-muted text-xs">Összes beváltás</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-muted text-xs">Aktív (még nem használt)</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{stats.active}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-muted text-xs">Felhasználva vásárláskor</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{stats.used}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-muted text-xs">Lejárt</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{stats.expired}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Keresés e-mail / név / kód…"
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground min-w-[220px]"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="all">Összes pontkupon</option>
          <option value="active">Aktív</option>
          <option value="used">Felhasználva</option>
          <option value="expired">Lejárt</option>
          <option value="inactive">Inaktív</option>
        </select>
        <button type="button" onClick={load} className="text-sm text-accent hover:underline">
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
                <th className="p-3 font-medium">Kód</th>
                <th className="p-3 font-medium">Kedvezmény</th>
                <th className="p-3 font-medium">Pont</th>
                <th className="p-3 font-medium">Állapot</th>
                <th className="p-3 font-medium">Beváltva</th>
                <th className="p-3 font-medium">Érvényes eddig</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--border)]/20">
                  <td className="p-3 font-medium text-foreground">{c.email ?? '—'}</td>
                  <td className="p-3 text-muted">{c.name ?? '—'}</td>
                  <td className="p-3 font-mono text-xs">{c.code}</td>
                  <td className="p-3 tabular-nums">{c.discountPercent}%</td>
                  <td className="p-3 tabular-nums text-muted">
                    {c.pointsSpent != null ? c.pointsSpent.toLocaleString('hu-HU') : '—'}
                  </td>
                  <td className="p-3">{statusBadge(c.status)}</td>
                  <td className="p-3 text-muted text-xs whitespace-nowrap">{formatDt(c.createdAt)}</td>
                  <td className="p-3 text-muted text-xs whitespace-nowrap">{formatDt(c.validUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted">Nincs pontból váltott kupon ebben a szűrésben.</p>
      )}
    </section>
  )
}
