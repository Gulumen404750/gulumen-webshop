'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Product } from '@/lib/data'
import { getProductName } from '@/lib/data'

type DealPopupConfig = {
  enabled: boolean
  title: string
  description: string
  productIds: string[]
}

type ApiResponse = {
  config: DealPopupConfig
  eligibleProducts: Product[]
  message?: string
}

export default function DealPopupSettings() {
  const [config, setConfig] = useState<DealPopupConfig | null>(null)
  const [eligibleProducts, setEligibleProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/deal-popup')
      if (!res.ok) throw new Error(res.status === 401 ? 'Nincs jogosultság' : 'Hiba a betöltésnél')
      const data: ApiResponse = await res.json()
      setConfig(data.config)
      setEligibleProducts(data.eligibleProducts ?? [])
      setMessage(data.message ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
      setConfig(null)
      setEligibleProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/deal-popup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Mentés sikertelen')
      }
      await fetchConfig()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  const setProductAt = (index: 0 | 1 | 2, productId: string) => {
    if (!config) return
    const next = [...config.productIds]
    next[index] = productId
    setConfig({ ...config, productIds: next })
  }

  const moveProduct = (from: number, to: number) => {
    if (!config || from < 0 || from > 2 || to < 0 || to > 2) return
    const next = [...config.productIds]
    const [removed] = next.splice(from, 1)
    next.splice(to, 0, removed)
    setConfig({ ...config, productIds: next })
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <h2 className="text-lg font-semibold mb-4">Akciós popup</h2>
        <p className="text-sm text-muted">Betöltés…</p>
      </section>
    )
  }

  if (error && !config) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <h2 className="text-lg font-semibold mb-4">Akciós popup</h2>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </section>
    )
  }

  const noDb = Boolean(message?.includes('nincs konfigurálva'))
  const c = config!
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Akciós popup</h2>
      {message && <p className="text-sm text-amber-600 dark:text-amber-400">{message}</p>}

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="popup-enabled"
          checked={c.enabled}
          onChange={(e) => setConfig({ ...c, enabled: e.target.checked })}
          className="rounded border-[var(--border)]"
        />
        <label htmlFor="popup-enabled" className="text-sm font-medium">
          Popup bekapcsolva (megjelenik a főoldalon)
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Cím</label>
        <input
          type="text"
          value={c.title}
          onChange={(e) => setConfig({ ...c, title: e.target.value })}
          className="w-full max-w-md rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
          placeholder="pl. Akciók most"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Leírás</label>
        <textarea
          value={c.description}
          onChange={(e) => setConfig({ ...c, description: e.target.value })}
          className="w-full max-w-md rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground min-h-[80px]"
          placeholder="Rövid szöveg a popupban"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Popupban megjelenő 3 termék (csak akciósak)</label>
        <p className="text-xs text-muted mb-2">
          Válaszd ki a 3 terméket sorrendben. Ha egy kiesik (elfogyott, inaktív), a rendszer automatikusan pótolja.
        </p>
        <div className="space-y-2">
          {([0, 1, 2] as const).map((idx) => {
            const productId = c.productIds[idx]
            const product = eligibleProducts.find((p) => p.id === productId)
            return (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted w-6">{idx + 1}.</span>
                <select
                  value={productId || ''}
                  onChange={(e) => setProductAt(idx, e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm min-w-[200px]"
                >
                  <option value="">— Válassz terméket —</option>
                  {eligibleProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getProductName(p, 'hu')} ({p.priceHuf} Ft)
                    </option>
                  ))}
                </select>
                {product && (
                  <>
                    <button
                      type="button"
                      onClick={() => moveProduct(idx, Math.max(0, idx - 1))}
                      disabled={idx === 0}
                      className="text-sm px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--border)]/30 disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveProduct(idx, Math.min(2, idx + 1))}
                      disabled={idx === 2}
                      className="text-sm px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--border)]/30 disabled:opacity-50"
                    >
                      ↓
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
        {eligibleProducts.length === 0 && (
          <p className="text-sm text-muted mt-2">Nincs akciós termék (akciós jelölés + kép, név, ár).</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || noDb}
          className="px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? 'Mentés…' : noDb ? 'Mentés (DB kell)' : 'Mentés'}
        </button>
      </div>
    </section>
  )
}
