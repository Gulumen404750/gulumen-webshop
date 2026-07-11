'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Product = {
  id: string
  slug: string
  name: string
  category: string
  type: string
  active: boolean
  archived: boolean
  onSale: boolean
  priceHuf: number
  stock: number
  sourcingEnabled: boolean
  dealEndAt: string | null
  saleEndAt: string | null
}

type StatusTab = 'active' | 'inactive' | 'archived' | 'all'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusTab, setStatusTab] = useState<StatusTab>('active')
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadProducts = useCallback(() => {
    setError(null)
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (typeFilter) params.set('type', typeFilter)
    if (statusTab !== 'all') params.set('status', statusTab)
    fetch(`/api/admin/products?${params}`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) {
          setError('Nincs jogosultság. Jelentkezz be: Admin belépés (API kulcs).')
          return { products: [] }
        }
        if (r.status === 503) {
          setError('Adatbázis nincs beállítva. Railway: DATABASE_URL változó kötelező a termékekhez.')
          return { products: [] }
        }
        return r.json()
      })
      .then((data) => {
        if (data.products) setProducts(data.products)
      })
      .catch(() => setError('Hálózati hiba. Próbáld újra.'))
      .finally(() => setLoading(false))
  }, [search, typeFilter, statusTab])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const updateStatus = async (id: string, patch: { active?: boolean; archived?: boolean }) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) loadProducts()
      else setError('Státusz frissítés sikertelen.')
    } catch {
      setError('Hálózati hiba.')
    } finally {
      setUpdatingId(null)
    }
  }

  const tabs: { id: StatusTab; label: string }[] = [
    { id: 'active', label: 'Aktív' },
    { id: 'inactive', label: 'Inaktív' },
    { id: 'archived', label: 'Archivált' },
    { id: 'all', label: 'Összes' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">Termékek</h1>
        <Link
          href="/admin/dashboard/products/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Új termék
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-400">
          <p className="font-medium">Hiba</p>
          <p className="text-sm mt-1">{error}</p>
          {error.includes('Jelentkezz be') && (
            <a href="/admin/login" className="text-sm underline mt-2 inline-block">→ Admin belépés</a>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-[var(--border)] text-foreground hover:opacity-80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Keresés (név, slug…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground min-w-[200px]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
        >
          <option value="">Összes típus</option>
          <option value="stock">Készlet</option>
          <option value="sourcing_deal">Beszerzés</option>
        </select>
      </div>

      {loading ? (
        <p className="text-muted">Betöltés…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 font-medium">Név</th>
                <th className="p-3 font-medium">Slug</th>
                <th className="p-3 font-medium">Kategória</th>
                <th className="p-3 font-medium">Típus</th>
                <th className="p-3 font-medium">Ár (Ft)</th>
                <th className="p-3 font-medium">Státusz</th>
                <th className="p-3 font-medium">Műveletek</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const statusLabel = p.archived ? 'Archivált' : p.active ? 'Aktív' : 'Inaktív'
                const statusColor = p.archived ? 'text-gray-500' : p.active ? 'text-green-600' : 'text-amber-600'
                const busy = updatingId === p.id
                return (
                  <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/20">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted">{p.slug}</td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3">
                      <span className={p.type === 'sourcing_deal' ? 'text-amber-600' : ''}>
                        {p.type === 'sourcing_deal' ? 'Beszerzés' : 'Készlet'}
                      </span>
                    </td>
                    <td className="p-3">{p.priceHuf.toLocaleString('hu-HU')}</td>
                    <td className={`p-3 font-medium ${statusColor}`}>{statusLabel}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {!p.active && !p.archived && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateStatus(p.id, { active: true, archived: false })}
                            className="text-xs px-2 py-1 rounded bg-green-600/10 text-green-700 dark:text-green-400 hover:bg-green-600/20 disabled:opacity-50"
                          >
                            Aktiválás
                          </button>
                        )}
                        {p.active && !p.archived && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateStatus(p.id, { active: false, archived: false })}
                            className="text-xs px-2 py-1 rounded bg-amber-600/10 text-amber-700 dark:text-amber-400 hover:bg-amber-600/20 disabled:opacity-50"
                          >
                            Inaktiválás
                          </button>
                        )}
                        {!p.archived && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateStatus(p.id, { active: false, archived: true })}
                            className="text-xs px-2 py-1 rounded bg-gray-600/10 text-gray-600 dark:text-gray-400 hover:bg-gray-600/20 disabled:opacity-50"
                          >
                            Archiválás
                          </button>
                        )}
                        {p.archived && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateStatus(p.id, { active: true, archived: false })}
                            className="text-xs px-2 py-1 rounded bg-green-600/10 text-green-700 dark:text-green-400 hover:bg-green-600/20 disabled:opacity-50"
                          >
                            Visszaállítás
                          </button>
                        )}
                        <Link href={`/admin/dashboard/products/${p.id}`} className="text-accent hover:underline text-xs">
                          Szerkesztés
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && products.length === 0 && (
        <p className="text-muted">Nincs termék ebben a kategóriában.</p>
      )}
    </div>
  )
}
