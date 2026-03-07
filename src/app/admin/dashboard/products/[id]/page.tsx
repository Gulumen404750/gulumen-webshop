'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type Product = {
  id: string
  slug: string
  name: string
  nameEn: string | null
  nameDe: string | null
  nameRo: string | null
  description: string
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

  useEffect(() => {
    if (isNew) return
    fetch(`/api/admin/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.product) setProduct(data.product)
      })
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
            description: product.description || '',
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
          }
        : {
            ...(product.slug && { slug: product.slug }),
            ...(product.name && { name: product.name }),
            nameEn: product.nameEn ?? undefined,
            nameDe: product.nameDe ?? undefined,
            nameRo: product.nameRo ?? undefined,
            description: product.description ?? '',
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
          }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
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
            <input
              value={product?.category ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, category: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
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

        <div>
          <label className="block text-sm font-medium mb-1">Leírás</label>
          <textarea
            value={product?.description ?? ''}
            onChange={(e) => setProduct((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
          />
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
            <label className="block text-sm font-medium mb-1">Kép URL</label>
            <input
              value={product?.image ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, image: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
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
            <Link
              href="/admin/dashboard/products"
              className="rounded-lg border border-[var(--border)] px-4 py-2 font-medium hover:bg-[var(--border)]"
            >
              Mégse
            </Link>
          )}
        </div>
      </form>
    </div>
  )
}
