'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Product = {
  id: string
  slug: string
  name: string
  category: string
  type: string
  active: boolean
  priceHuf: number
  stock: number
  sourcingEnabled: boolean
  dealEndAt: string | null
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (typeFilter) params.set('type', typeFilter)
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
  }, [search, typeFilter])

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
                <th className="p-3 font-medium">Készlet</th>
                <th className="p-3 font-medium">Aktív</th>
                <th className="p-3 font-medium">Lejár</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
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
                  <td className="p-3">{p.stock}</td>
                  <td className="p-3">{p.active ? 'Igen' : 'Nem'}</td>
                  <td className="p-3 text-muted">
                    {p.dealEndAt ? new Date(p.dealEndAt).toLocaleDateString('hu-HU') : '–'}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/dashboard/products/${p.id}`}
                      className="text-accent hover:underline"
                    >
                      Szerkesztés
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && products.length === 0 && (
        <p className="text-muted">Nincs termék. Futtasd a seed-et vagy hozz létre újat.</p>
      )}
    </div>
  )
}
