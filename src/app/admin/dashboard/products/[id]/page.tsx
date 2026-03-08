'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { categories, threeDSubcategories } from '@/lib/data'

type Product = {
  id: string
  slug: string
  name: string
  nameEn: string | null
  nameDe: string | null
  nameRo: string | null
  description: string
  description_hu: string | null
  description_en: string | null
  description_de: string | null
  condition: string
  category: string
  image: string
  images: string[]
  images360: string[]
  modelUrl: string | null
  priceHuf: number
  priceEur: number
  discountPriceHuf: number | null
  discountPriceEur: number | null
  stock: number
  variants: unknown
  isNew: boolean
  onSale: boolean
  active: boolean
  isColorable: boolean
  type: string
  sourcingEnabled: boolean
  dealStartAt: string | null
  dealEndAt: string | null
  previewFrom: string | null
  maxOrders: number | null
  sortOrder: number | null
}

export default function AdminProductEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const isNew = id === 'new'
  const [product, setProduct] = useState<Partial<Product> | null>(isNew ? {} : null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const mainImageInputRef = useRef<HTMLInputElement>(null)
  const galleryImageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetch(`/api/admin/products/${id}`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) {
          setMessage({ type: 'error', text: 'Nincs jogosultság. Jelentkezz be: Admin belépés (API kulcs).' })
          return {}
        }
        if (r.status === 503) {
          setMessage({ type: 'error', text: 'Adatbázis nincs beállítva (DATABASE_URL a Railway-en).' })
          return {}
        }
        return r.json()
      })
      .then((data: { product?: Product }) => {
        if (data.product) setProduct(data.product)
      })
      .catch(() => setMessage({ type: 'error', text: 'Hálózati hiba.' }))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return
    setSaving(true)
    setMessage(null)
    try {
      const url = isNew ? '/api/admin/products' : `/api/admin/products/${id}`
      const method = isNew ? 'POST' : 'PATCH'
      const body = isNew
        ? {
            slug: product.slug || '',
            name: product.name || '',
            nameEn: product.nameEn || undefined,
            nameDe: product.nameDe || undefined,
            nameRo: product.nameRo || undefined,
            description_hu: product.description_hu ?? product.description ?? '',
            description_en: product.description_en ?? product.description ?? '',
            description_de: product.description_de ?? product.description ?? '',
            condition: product.condition || 'Új',
            category: product.category || 'taskak',
            image: product.image || '',
            images: product.images || [],
            images360: product.images360 || [],
            modelUrl: product.modelUrl || undefined,
            priceHuf: product.priceHuf ?? 0,
            priceEur: product.priceEur ?? 0,
            discountPriceHuf: product.discountPriceHuf ?? undefined,
            discountPriceEur: product.discountPriceEur ?? undefined,
            stock: product.stock ?? 0,
            isNew: product.isNew ?? false,
            onSale: product.onSale ?? false,
            active: product.active ?? true,
            isColorable: product.isColorable ?? false,
            type: product.type || 'stock',
            sourcingEnabled: product.sourcingEnabled ?? false,
            dealStartAt: product.dealStartAt || undefined,
            dealEndAt: product.dealEndAt || undefined,
            previewFrom: product.previewFrom || undefined,
            maxOrders: product.maxOrders ?? undefined,
            sortOrder: product.sortOrder ?? undefined,
          }
        : {
            ...(product.name && { name: product.name }),
            nameEn: product.nameEn ?? undefined,
            nameDe: product.nameDe ?? undefined,
            nameRo: product.nameRo ?? undefined,
            description_hu: product.description_hu ?? product.description ?? '',
            description_en: product.description_en ?? product.description ?? '',
            description_de: product.description_de ?? product.description ?? '',
            condition: product.condition ?? 'Új',
            category: product.category ?? 'taskak',
            image: product.image ?? '',
            images: product.images ?? [],
            images360: product.images360 ?? [],
            modelUrl: product.modelUrl ?? undefined,
            priceHuf: product.priceHuf ?? 0,
            priceEur: product.priceEur ?? 0,
            discountPriceHuf: product.discountPriceHuf ?? undefined,
            discountPriceEur: product.discountPriceEur ?? undefined,
            stock: product.stock ?? 0,
            isNew: product.isNew ?? false,
            onSale: product.onSale ?? false,
            active: product.active ?? true,
            isColorable: product.isColorable ?? false,
            type: product.type || 'stock',
            sourcingEnabled: product.sourcingEnabled ?? false,
            dealStartAt: product.dealStartAt || undefined,
            dealEndAt: product.dealEndAt || undefined,
            previewFrom: product.previewFrom || undefined,
            maxOrders: product.maxOrders ?? undefined,
            sortOrder: product.sortOrder ?? undefined,
          }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          setMessage({ type: 'error', text: 'Nincs jogosultság. Jelentkezz be újra az admin kulccsal.' })
          return
        }
        if (res.status === 503) {
          setMessage({ type: 'error', text: 'Adatbázis nincs beállítva (DATABASE_URL).' })
          return
        }
        setMessage({ type: 'error', text: data?.error || 'Hiba történt' })
        return
      }
      setMessage({ type: 'ok', text: isNew ? 'Termék létrehozva.' : 'Mentve.' })
      if (isNew && data.product) {
        setTimeout(() => router.push(`/admin/dashboard/products/${data.product.id}`), 800)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted">Betöltés…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/dashboard/products" className="text-muted hover:text-foreground">
          ← Termékek
        </Link>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          {isNew ? 'Új termék' : 'Termék szerkesztése'}
        </h1>
      </div>

      {message && (
        <p className={message.type === 'ok' ? 'text-green-600' : 'text-red-600'}>
          {message.text}
        </p>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Slug *</label>
            <input
              value={product?.slug ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, slug: e.target.value }))}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategória</label>
            <div className="space-y-2">
              <select
                value={product?.category?.startsWith('3d-') ? '3d-nyomtatott' : (product?.category || 'taskak')}
                onChange={(e) => {
                  const main = e.target.value
                  if (main !== '3d-nyomtatott') setProduct((p) => ({ ...p, category: main }))
                  else setProduct((p) => ({ ...p, category: '3d-konyha' }))
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
              {(product?.category?.startsWith('3d-') || (product?.category || 'taskak') === '3d-nyomtatott') && (
                <select
                  value={product?.category?.startsWith('3d-') ? product.category : '3d-konyha'}
                  onChange={(e) => setProduct((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                >
                  {threeDSubcategories.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.icon} {s.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Név (HU) *</label>
          <input
            value={product?.name ?? ''}
            onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))}
            required
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-1">Név (EN)</label>
            <input
              value={product?.nameEn ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, nameEn: e.target.value || null }))}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Név (DE)</label>
            <input
              value={product?.nameDe ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, nameDe: e.target.value || null }))}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Név (RO)</label>
            <input
              value={product?.nameRo ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, nameRo: e.target.value || null }))}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Leírás (HU)</label>
            <textarea
              value={product?.description_hu ?? product?.description ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, description_hu: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Leírás (EN) – fallback</label>
            <textarea
              value={product?.description_en ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, description_en: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Leírás (DE)</label>
            <textarea
              value={product?.description_de ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, description_de: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Ár (Ft) *</label>
            <input
              type="number"
              value={product?.priceHuf ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, priceHuf: Number(e.target.value) || 0 }))}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Akciós ár (Ft)</label>
            <input
              type="number"
              value={product?.discountPriceHuf ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, discountPriceHuf: e.target.value ? Number(e.target.value) : null }))}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Készlet</label>
            <input
              type="number"
              value={product?.stock ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, stock: Number(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fő kép URL</label>
            <p className="text-xs text-muted mb-1">Írd be az URL-t vagy tölts fel képet a gépről (JPEG, PNG, max 5 MB). Élesben (Railway) a feltöltött fájlok deploy után eltűnhetnek – külső tároló (pl. Google Drive, Cloudinary) URL-je ajánlott.</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={product?.image ?? ''}
                onChange={(e) => setProduct((p) => ({ ...p, image: e.target.value }))}
                placeholder="https://… vagy kattints a Feltöltés gombra"
                className="flex-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
              <input
                ref={mainImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const form = new FormData()
                  form.append('file', file)
                  setMessage(null)
                  try {
                    const res = await fetch('/api/admin/upload', { method: 'POST', credentials: 'include', body: form })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && data.url) {
                      setProduct((p) => ({ ...p, image: data.url }))
                      setMessage({ type: 'ok', text: 'Fő kép feltöltve.' })
                    } else {
                      setMessage({ type: 'error', text: data?.error || 'Feltöltés sikertelen. (Ellenőrizd a bejelentkezést és a fájlméretet.)' })
                    }
                  } catch {
                    setMessage({ type: 'error', text: 'Feltöltés hiba. (Hálózat vagy szerver.)' })
                  }
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => mainImageInputRef.current?.click()}
                className="shrink-0 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)]/30"
              >
                Feltöltés (gépről)
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Galéria (több kép URL)</label>
          <p className="text-xs text-muted mb-2">A fő kép alatt megjelenő képek. Add hozzá az URL-eket, tölts fel a gépről, vagy töröld őket.</p>
          <div className="space-y-2">
            {(product?.images?.length ? product.images : []).map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => {
                    const next = [...(product?.images ?? [])]
                    next[i] = e.target.value
                    setProduct((p) => ({ ...p, images: next }))
                  }}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm"
                  placeholder="Kép URL"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = (product?.images ?? []).filter((_, j) => j !== i)
                    setProduct((p) => ({ ...p, images: next }))
                  }}
                  className="shrink-0 rounded-lg border border-red-500/50 px-3 py-2 text-red-600 text-sm hover:bg-red-500/10"
                >
                  Törlés
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <input
                ref={galleryImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const form = new FormData()
                  form.append('file', file)
                  try {
                    const res = await fetch('/api/admin/upload', { method: 'POST', credentials: 'include', body: form })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && data.url) {
                      setProduct((p) => ({ ...p, images: [...(p?.images ?? []), data.url] }))
                      setMessage({ type: 'ok', text: 'Galéria kép hozzáadva.' })
                    } else setMessage({ type: 'error', text: data?.error || 'Feltöltés sikertelen.' })
                  } catch {
                    setMessage({ type: 'error', text: 'Feltöltés hiba.' })
                  }
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => galleryImageInputRef.current?.click()}
                className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-muted hover:bg-[var(--border)]/20"
              >
                + Kép feltöltése a gépről
              </button>
              <button
                type="button"
                onClick={() => setProduct((p) => ({ ...p, images: [...(p?.images ?? []), ''] }))}
                className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-muted hover:bg-[var(--border)]/20"
              >
                + Kép URL hozzáadása
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">3D model URL</label>
          <input
            value={product?.modelUrl ?? ''}
            onChange={(e) => setProduct((p) => ({ ...p, modelUrl: e.target.value || null }))}
            placeholder="/models/xxx.glb"
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={product?.active ?? true}
              onChange={(e) => setProduct((p) => ({ ...p, active: e.target.checked }))}
              className="rounded border-[var(--border)]"
            />
            Aktív
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={product?.isNew ?? false}
              onChange={(e) => setProduct((p) => ({ ...p, isNew: e.target.checked }))}
              className="rounded border-[var(--border)]"
            />
            Újdonság
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={product?.onSale ?? false}
              onChange={(e) => setProduct((p) => ({ ...p, onSale: e.target.checked }))}
              className="rounded border-[var(--border)]"
            />
            Akciós
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={product?.type === 'sourcing_deal'}
              onChange={(e) => setProduct((p) => ({ ...p, type: e.target.checked ? 'sourcing_deal' : 'stock', sourcingEnabled: e.target.checked }))}
              className="rounded border-[var(--border)]"
            />
            Beszerzéses deal
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={product?.isColorable ?? false}
              onChange={(e) => setProduct((p) => ({ ...p, isColorable: e.target.checked }))}
              className="rounded border-[var(--border)]"
            />
            Színezhető (3D)
          </label>
        </div>

        {product?.type === 'sourcing_deal' && (
          <div className="grid gap-4 sm:grid-cols-2 border-t border-[var(--border)] pt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sorrend (beszerzésre rendelhető listán)</label>
              <input
                type="number"
                value={product?.sortOrder ?? ''}
                onChange={(e) => setProduct((p) => ({ ...p, sortOrder: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="Üres = automatikus (lejárat szerint)"
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
              <p className="text-xs text-muted mt-1">Kisebb szám = előrébb. Pl. 1, 2, 3.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vásárlás indul (ISO)</label>
              <input
                value={product?.dealStartAt?.slice(0, 16) ?? ''}
                onChange={(e) => setProduct((p) => ({ ...p, dealStartAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                type="datetime-local"
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vásárlás vége (ISO)</label>
              <input
                value={product?.dealEndAt?.slice(0, 16) ?? ''}
                onChange={(e) => setProduct((p) => ({ ...p, dealEndAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                type="datetime-local"
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max rendelések</label>
              <input
                type="number"
                value={product?.maxOrders ?? ''}
                onChange={(e) => setProduct((p) => ({ ...p, maxOrders: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Mentés…' : 'Mentés'}
          </button>
          {!isNew && (
            <>
              <Link
                href="/admin/dashboard/products"
                className="rounded-lg border border-[var(--border)] px-4 py-2 font-medium hover:bg-[var(--border)]"
              >
                Mégse
              </Link>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Törlöd ezt a terméket? Ez visszavonhatatlan.')) return
                  setSaving(true)
                  try {
                    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE', credentials: 'include' })
                    if (res.ok) {
                      router.push('/admin/dashboard/products')
                      router.refresh()
                    } else {
                      const d = await res.json().catch(() => ({}))
                      setMessage({ type: 'error', text: d?.error || 'Törlés sikertelen.' })
                    }
                  } catch {
                    setMessage({ type: 'error', text: 'Hálózati hiba.' })
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="rounded-lg border border-red-500/50 px-4 py-2 text-red-600 font-medium hover:bg-red-500/10 disabled:opacity-60"
              >
                Termék törlése
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
