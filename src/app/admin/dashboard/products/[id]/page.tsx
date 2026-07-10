'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { categories, threeDSubcategories } from '@/lib/data'
import { ProductImageUploader } from '@/components/ProductImageUploader'

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
  description_ro: string | null
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
  const modelInputRef = useRef<HTMLInputElement>(null)
  const [modelUploading, setModelUploading] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)

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
            description_ro: product.description_ro ?? product.description ?? '',
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
            description_ro: product.description_ro ?? product.description ?? '',
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

        {(product?.name ?? '').trim() && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--border)]/20">
            <span className="text-sm font-medium text-foreground">AI fordítás (nevek):</span>
            <p className="text-xs text-muted">A magyar név alapján kitölti az EN, RO, DE mezőket (új terméknél csak a űrlapot; mentett terméknél opcionálisan felülírás).</p>
            <button
              type="button"
              onClick={async () => {
                setMessage(null)
                try {
                  if (isNew) {
                    const res = await fetch('/api/admin/translate-draft', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ type: 'names', text: (product?.name ?? '').trim() }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && (data.nameEn != null || data.nameDe != null || data.nameRo != null)) {
                      setProduct((p) => (p ? {
                        ...p,
                        nameEn: data.nameEn ?? p.nameEn ?? '',
                        nameDe: data.nameDe ?? p.nameDe ?? '',
                        nameRo: data.nameRo ?? p.nameRo ?? '',
                      } : p))
                      setMessage({ type: 'ok', text: 'Névfordítás kész (űrlap).' })
                    } else {
                      setMessage({ type: 'error', text: data?.error || 'Fordítás sikertelen.' })
                    }
                  } else {
                    const res = await fetch(`/api/admin/products/${id}/translate-names`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ overwriteExisting: false }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && data.product) {
                      setProduct((p) => (p ? {
                        ...p,
                        nameEn: data.product.nameEn ?? '',
                        nameDe: data.product.nameDe ?? '',
                        nameRo: data.product.nameRo ?? '',
                      } : p))
                      setMessage({ type: 'ok', text: data.message || 'Névfordítás kész.' })
                    } else {
                      setMessage({ type: 'error', text: data?.error || 'Fordítás sikertelen.' })
                    }
                  }
                } catch {
                  setMessage({ type: 'error', text: 'Hálózati hiba.' })
                }
              }}
              className="rounded-lg bg-accent/90 text-white px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              AI fordítás nevek (EN, RO, DE)
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Felülírod a meglévő EN, RO, DE neveket?')) return
                  setMessage(null)
                  try {
                    const res = await fetch(`/api/admin/products/${id}/translate-names`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ overwriteExisting: true }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && data.product) {
                      setProduct((p) => (p ? {
                        ...p,
                        nameEn: data.product.nameEn ?? '',
                        nameDe: data.product.nameDe ?? '',
                        nameRo: data.product.nameRo ?? '',
                      } : p))
                      setMessage({ type: 'ok', text: data.message || 'Névfordítás felülírva.' })
                    } else {
                      setMessage({ type: 'error', text: data?.error || 'Fordítás sikertelen.' })
                    }
                  } catch {
                    setMessage({ type: 'error', text: 'Hálózati hiba.' })
                  }
                }}
                className="rounded-lg border border-amber-500/60 text-amber-700 dark:text-amber-400 px-4 py-2 text-sm font-medium hover:bg-amber-500/10"
              >
                AI fordítás nevek (felülírás)
              </button>
            )}
          </div>
        )}

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
          <div>
            <label className="block text-sm font-medium mb-1">Leírás (RO)</label>
            <textarea
              value={product?.description_ro ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, description_ro: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
          </div>
        </div>

        {(product?.description_hu ?? product?.description ?? '').trim() && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--border)]/20">
            <span className="text-sm font-medium text-foreground">AI fordítás (leírás):</span>
            <p className="text-xs text-muted">A magyar leírás alapján kitölti az EN, RO, DE mezőket (új terméknél csak a űrlapot; mentett terméknél opcionálisan felülírás).</p>
            <button
              type="button"
              onClick={async () => {
                setMessage(null)
                const huText = (product?.description_hu ?? product?.description ?? '').trim()
                try {
                  if (isNew) {
                    const res = await fetch('/api/admin/translate-draft', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ type: 'description', text: huText }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && (data.descriptionEn != null || data.descriptionDe != null || data.descriptionRo != null)) {
                      setProduct((p) => (p ? {
                        ...p,
                        description_en: data.descriptionEn ?? p.description_en ?? '',
                        description_de: data.descriptionDe ?? p.description_de ?? '',
                        description_ro: data.descriptionRo ?? p.description_ro ?? '',
                      } : p))
                      setMessage({ type: 'ok', text: 'Leírás fordítás kész (űrlap).' })
                    } else {
                      setMessage({ type: 'error', text: data?.error || 'Fordítás sikertelen.' })
                    }
                  } else {
                    const res = await fetch(`/api/admin/products/${id}/translate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ overwriteExisting: false }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && data.product) {
                      setProduct((p) => (p ? {
                        ...p,
                        description_en: data.product.description_en ?? p.description_en,
                        description_de: data.product.description_de ?? p.description_de,
                        description_ro: data.product.description_ro ?? p.description_ro,
                      } : p))
                      setMessage({ type: 'ok', text: data.message || 'Fordítás kész.' })
                    } else {
                      setMessage({ type: 'error', text: data?.error || 'Fordítás sikertelen.' })
                    }
                  }
                } catch {
                  setMessage({ type: 'error', text: 'Hálózati hiba.' })
                }
              }}
              className="rounded-lg bg-accent/90 text-white px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              AI fordítás (EN, RO, DE)
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Felülírod a meglévő EN, RO, DE szövegeket?')) return
                  setMessage(null)
                  try {
                    const res = await fetch(`/api/admin/products/${id}/translate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ overwriteExisting: true }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && data.product) {
                      setProduct((p) => (p ? {
                        ...p,
                        description_en: data.product.description_en ?? '',
                        description_de: data.product.description_de ?? '',
                        description_ro: data.product.description_ro ?? '',
                      } : p))
                      setMessage({ type: 'ok', text: data.message || 'Fordítás felülírva.' })
                    } else {
                      setMessage({ type: 'error', text: data?.error || 'Fordítás sikertelen.' })
                    }
                  } catch {
                    setMessage({ type: 'error', text: 'Hálózati hiba.' })
                  }
                }}
                className="rounded-lg border border-amber-500/60 text-amber-700 dark:text-amber-400 px-4 py-2 text-sm font-medium hover:bg-amber-500/10"
              >
                AI fordítás (felülírás)
              </button>
            )}
          </div>
        )}

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
          <div className="sm:col-span-2">
            <ProductImageUploader
              label="Fő kép"
              value={product?.image ?? ''}
              onChange={(url) => setProduct((p) => (p ? { ...p, image: url } : p))}
              showUrlInput={true}
              urlPlaceholder="https://… vagy húzd ide / kattints a feltöltéshez"
            />
            <p className="text-xs text-muted mt-2">
              Gépről: húzd a képet vagy kattints — JPEG, PNG, WebP, GIF (max 25 MB). Külső link: pl. Google Drive közvetlen képlink.
            </p>
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
            <div className="flex flex-wrap gap-2 items-start">
              <ProductImageUploader
                label="+ Kép feltöltése a gépről (húzd ide vagy kattints)"
                value=""
                onChange={() => {}}
                showUrlInput={false}
                mode="add"
                onAddUrl={(url) => setProduct((p) => (p ? { ...p, images: [...(p?.images ?? []), url] } : p))}
              />
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
          <p className="text-xs text-muted mb-2">
            Add meg a modell URL-jét (pl. <code className="bg-[var(--border)] px-1 rounded">/models/xxx.glb</code>), vagy tölts fel egy .glb / .gltf fájlt.
          </p>
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <input
              value={product?.modelUrl ?? ''}
              onChange={(e) => { setModelError(null); setProduct((p) => ({ ...p, modelUrl: e.target.value || null })) }}
              placeholder="/models/xxx.glb"
              className="flex-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
            <input
              ref={modelInputRef}
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (!/\.(glb|gltf)$/i.test(file.name)) {
                  setModelError('Csak .glb vagy .gltf fájl tölthető fel.')
                  return
                }
                setModelError(null)
                setModelUploading(true)
                try {
                  const form = new FormData()
                  form.append('file', file)
                  const res = await fetch('/api/admin/upload-model', { method: 'POST', credentials: 'include', body: form })
                  const data = await res.json().catch(() => ({}))
                  if (res.ok && data.url) {
                    setProduct((p) => (p ? { ...p, modelUrl: data.url } : p))
                    setMessage({ type: 'ok', text: '3D modell feltöltve.' })
                  } else {
                    setModelError(data?.error || 'Feltöltés sikertelen.')
                  }
                } catch {
                  setModelError('Hálózati hiba.')
                } finally {
                  setModelUploading(false)
                  e.target.value = ''
                }
              }}
            />
            <button
              type="button"
              onClick={() => modelInputRef.current?.click()}
              disabled={modelUploading}
              className="shrink-0 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)]/30 disabled:opacity-60"
            >
              {modelUploading ? 'Feltöltés…' : 'Fájl feltöltése (.glb / .gltf)'}
            </button>
          </div>
          <div
            className="border-2 border-dashed border-[var(--border)] rounded-lg p-4 text-center text-sm text-muted hover:border-accent/50 hover:bg-[var(--border)]/10 transition-colors cursor-pointer"
            onClick={() => !modelUploading && modelInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const file = e.dataTransfer?.files?.[0]
              if (!file || modelUploading) return
              if (!/\.(glb|gltf)$/i.test(file.name)) {
                setModelError('Csak .glb vagy .gltf fájl.')
                return
              }
              setModelError(null)
              setModelUploading(true)
              const form = new FormData()
              form.append('file', file)
              fetch('/api/admin/upload-model', { method: 'POST', credentials: 'include', body: form })
                .then((r) => r.json().catch(() => ({})))
                .then((data) => {
                  if (data?.url) {
                    setProduct((p) => (p ? { ...p, modelUrl: data.url } : p))
                    setMessage({ type: 'ok', text: '3D modell feltöltve.' })
                  } else {
                    setModelError(data?.error || 'Feltöltés sikertelen.')
                  }
                })
                .catch(() => setModelError('Hálózati hiba.'))
                .finally(() => { setModelUploading(false) })
            }}
          >
            {modelUploading ? 'Feltöltés…' : 'Húzd ide a .glb / .gltf fájlt, vagy kattints a feltöltéshez'}
          </div>
          {modelError && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{modelError}</p>}
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
