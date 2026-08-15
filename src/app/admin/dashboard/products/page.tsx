'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AdminProductsListSkeleton } from '@/components/AdminTableSkeleton'

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
  viewsCount?: number
  sourcingEnabled: boolean
  dealEndAt: string | null
  saleEndAt: string | null
}

type StatusTab = 'active' | 'inactive' | 'archived' | 'all'
type SortMode = 'updated' | 'popular'
type PriceMode = 'fixed' | 'percent'

type BulkPriceModalProps = {
  count: number
  mode: PriceMode
  fixedPrice: string
  percentChange: string
  saving: boolean
  formError: string | null
  onModeChange: (mode: PriceMode) => void
  onFixedPriceChange: (value: string) => void
  onPercentChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}

function BulkPriceModal({
  count,
  mode,
  fixedPrice,
  percentChange,
  saving,
  formError,
  onModeChange,
  onFixedPriceChange,
  onPercentChange,
  onClose,
  onSubmit,
}: BulkPriceModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-price-modal-title"
      >
        <h2 id="bulk-price-modal-title" className="text-lg font-semibold text-foreground mb-1">
          Ár módosítás
        </h2>
        <p className="text-sm text-muted mb-4">
          {count} kijelölt termék
        </p>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {formError}
          </div>
        )}

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Módosítás típusa</legend>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="priceMode"
                checked={mode === 'fixed'}
                onChange={() => onModeChange('fixed')}
                className="accent-accent"
              />
              Új ár (Ft)
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="priceMode"
                checked={mode === 'percent'}
                onChange={() => onModeChange('percent')}
                className="accent-accent"
              />
              Százalékos emelés / csökkentés
            </label>
          </fieldset>

          {mode === 'fixed' ? (
            <label className="block">
              <span className="text-sm font-medium text-foreground">Új ár (Ft) *</span>
              <input
                type="number"
                min={0}
                step={1}
                value={fixedPrice}
                onChange={(e) => onFixedPriceChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                placeholder="pl. 4990"
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-foreground">Százalék (%) *</span>
              <input
                type="number"
                min={-99}
                max={1000}
                step={1}
                value={percentChange}
                onChange={(e) => onPercentChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                placeholder="pl. 10 vagy -5"
              />
              <p className="text-xs text-muted mt-1">
                Pozitív érték emeli, negatív csökkenti az árat. Az EUR ár arányosan módosul.
              </p>
            </label>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)]/30 disabled:opacity-60"
          >
            Mégse
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Mentés…' : 'Alkalmazás'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusTab, setStatusTab] = useState<StatusTab>('active')
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  const [lowStockFilter, setLowStockFilter] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [priceModalOpen, setPriceModalOpen] = useState(false)
  const [priceMode, setPriceMode] = useState<PriceMode>('fixed')
  const [fixedPrice, setFixedPrice] = useState('')
  const [percentChange, setPercentChange] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkFormError, setBulkFormError] = useState<string | null>(null)
  const [bulkDeleteMsg, setBulkDeleteMsg] = useState<string | null>(null)

  const loadProducts = useCallback(() => {
    setError(null)
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (typeFilter) params.set('type', typeFilter)
    if (lowStockFilter) {
      params.set('lowStock', '1')
    } else if (statusTab !== 'all') {
      params.set('status', statusTab)
    }
    if (sortMode === 'popular') params.set('sort', 'popular')
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
        if (data.products) {
          setProducts(data.products)
          setSelectedIds((prev) => {
            const visible = new Set(data.products.map((p: Product) => p.id))
            return new Set([...prev].filter((id) => visible.has(id)))
          })
        }
      })
      .catch(() => setError('Hálózati hiba. Próbáld újra.'))
      .finally(() => setLoading(false))
  }, [search, typeFilter, statusTab, lowStockFilter, sortMode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const low = params.get('lowStock') === '1' || params.get('lowStock') === 'true'
    setLowStockFilter(low)
    if (low) setStatusTab('active')
    const sort = params.get('sort')
    if (sort === 'popular' || sort === 'views') setSortMode('popular')
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id))
  const someSelected = products.some((p) => selectedIds.has(p.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openPriceModal = () => {
    setBulkFormError(null)
    setPriceMode('fixed')
    setFixedPrice('')
    setPercentChange('')
    setPriceModalOpen(true)
  }

  const closePriceModal = () => {
    if (!bulkSaving) setPriceModalOpen(false)
  }

  const handleBulkPrice = async () => {
    setBulkFormError(null)

    if (selectedIds.size > 10) {
      const ok = window.confirm(
        `${selectedIds.size} termék ármódosítása. Ha nem owner vagy, owner jóváhagyás kell (5 perc). Folytatod?`
      )
      if (!ok) return
    }

    const body: {
      productIds: string[]
      mode: PriceMode
      priceHuf?: number
      percentChange?: number
    } = {
      productIds: Array.from(selectedIds),
      mode: priceMode,
    }

    if (priceMode === 'fixed') {
      const price = Number.parseInt(fixedPrice, 10)
      if (!Number.isFinite(price) || price < 0) {
        setBulkFormError('Adj meg érvényes árat (0 vagy nagyobb).')
        return
      }
      body.priceHuf = price
    } else {
      const pct = Number.parseFloat(percentChange)
      if (!Number.isFinite(pct) || pct < -99 || pct > 1000) {
        setBulkFormError('A százalék -99 és 1000 között lehet.')
        return
      }
      body.percentChange = pct
    }

    setBulkSaving(true)
    setBulkDeleteMsg(null)
    try {
      const res = await fetch('/api/admin/products/bulk-price', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 202 && data.status === 'PENDING_APPROVAL') {
        setPriceModalOpen(false)
        setSelectedIds(new Set())
        setBulkDeleteMsg(
          data.message ||
            `Ármódosítás jóváhagyásra vár (${data.secondsRemaining ?? 300} mp). Az owner dashboardon jelenik meg.`
        )
        return
      }
      if (!res.ok) {
        setBulkFormError(data.error ?? 'Ármódosítás sikertelen.')
        return
      }
      setPriceModalOpen(false)
      setSelectedIds(new Set())
      loadProducts()
    } catch {
      setBulkFormError('Hálózati hiba.')
    } finally {
      setBulkSaving(false)
    }
  }

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    if (count === 0) return
    const ok = window.confirm(
      count > 10
        ? `${count} termék törlése. Ha nem owner vagy, owner jóváhagyás kell (5 perc). Folytatod?`
        : `${count} termék végleges törlése. Biztosan?`
    )
    if (!ok) return
    setBulkDeleteMsg(null)
    setBulkSaving(true)
    try {
      const res = await fetch('/api/admin/products/bulk-delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selectedIds) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 202 && data.status === 'PENDING_APPROVAL') {
        setBulkDeleteMsg(
          data.message ||
            `Jóváhagyásra vár (${data.secondsRemaining ?? 300} mp). Az owner dashboardon jelenik meg.`
        )
        setSelectedIds(new Set())
        return
      }
      if (!res.ok) {
        setBulkDeleteMsg(data.error ?? 'Törlés sikertelen.')
        return
      }
      setBulkDeleteMsg(`Törölve: ${data.deleted ?? count} termék.`)
      setSelectedIds(new Set())
      loadProducts()
    } catch {
      setBulkDeleteMsg('Hálózati hiba.')
    } finally {
      setBulkSaving(false)
    }
  }

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
            onClick={() => {
              setLowStockFilter(false)
              setStatusTab(tab.id)
              router.replace('/admin/dashboard/products')
            }}
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
        </select>
        <select
          value={sortMode}
          onChange={(e) => {
            const next = e.target.value === 'popular' ? 'popular' : 'updated'
            setSortMode(next)
            const params = new URLSearchParams(window.location.search)
            if (next === 'popular') params.set('sort', 'popular')
            else params.delete('sort')
            const qs = params.toString()
            router.replace(qs ? `/admin/dashboard/products?${qs}` : '/admin/dashboard/products')
          }}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
          aria-label="Rendezés"
        >
          <option value="updated">Legutóbb módosított</option>
          <option value="popular">Legnépszerűbb termékek</option>
        </select>
      </div>

      {lowStockFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Szűrő: aktív termékek készlete 3 alatt
          </p>
          <button
            type="button"
            onClick={() => {
              setLowStockFilter(false)
              router.replace('/admin/dashboard/products')
            }}
            className="text-sm text-amber-700 dark:text-amber-400 hover:underline"
          >
            Szűrő törlése
          </button>
        </div>
      )}

      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} kijelölve
          </span>
          <button
            type="button"
            onClick={openPriceModal}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Ár módosítás
          </button>
          <button
            type="button"
            disabled={bulkSaving}
            onClick={() => void handleBulkDelete()}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-500/20 disabled:opacity-60"
          >
            Törlés
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-muted hover:text-foreground"
          >
            Kijelölés törlése
          </button>
        </div>
      )}

      {bulkDeleteMsg && (
        <p className="text-sm text-muted rounded-lg border border-[var(--border)] px-3 py-2">
          {bulkDeleteMsg}
        </p>
      )}

      {loading ? (
        <AdminProductsListSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected
                    }}
                    onChange={toggleAll}
                    aria-label="Összes kijelölése"
                    className="accent-accent"
                  />
                </th>
                <th className="p-3 font-medium">Név</th>
                <th className="p-3 font-medium">Slug</th>
                <th className="p-3 font-medium">Kategória</th>
                <th className="p-3 font-medium">Típus</th>
                <th className="p-3 font-medium">Ár (Ft)</th>
                <th className="p-3 font-medium">Megtekintések</th>
                <th className="p-3 font-medium">Státusz</th>
                <th className="p-3 font-medium">Műveletek</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const statusLabel = p.archived ? 'Archivált' : p.active ? 'Aktív' : 'Inaktív'
                const statusColor = p.archived ? 'text-gray-500' : p.active ? 'text-green-600' : 'text-amber-600'
                const busy = updatingId === p.id
                const checked = selectedIds.has(p.id)
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-[var(--border)] hover:bg-[var(--border)]/20 ${
                      checked ? 'bg-accent/5' : ''
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(p.id)}
                        aria-label={`${p.name} kijelölése`}
                        className="accent-accent"
                      />
                    </td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted">{p.slug}</td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3">
                      <span className={p.type === 'sourcing_deal' ? 'text-amber-600' : ''}>
                        {p.type === 'sourcing_deal' ? 'Beszerzés' : 'Készlet'}
                      </span>
                    </td>
                    <td className="p-3">{p.priceHuf.toLocaleString('hu-HU')}</td>
                    <td className="p-3 tabular-nums">
                      {(p.viewsCount ?? 0).toLocaleString('hu-HU')}
                    </td>
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

      {priceModalOpen && (
        <BulkPriceModal
          count={selectedIds.size}
          mode={priceMode}
          fixedPrice={fixedPrice}
          percentChange={percentChange}
          saving={bulkSaving}
          formError={bulkFormError}
          onModeChange={setPriceMode}
          onFixedPriceChange={setFixedPrice}
          onPercentChange={setPercentChange}
          onClose={closePriceModal}
          onSubmit={handleBulkPrice}
        />
      )}
    </div>
  )
}
