'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { categories, threeDSubcategories } from '@/lib/data'
import { ProductColorImagesEditor } from '@/components/ProductColorImagesEditor'
import {
  getBaseColorVariant,
  normalizeColorVariants,
  serializeColorVariants,
  type ColorVariant,
} from '@/lib/filamentColors'
import { buildProductGallery, normalizeImageUrls, normalizeImageUrl } from '@/lib/product-images'
import { cleanCdnUrl, cleanCdnUrls } from '@/lib/cdn'
import { UNLIMITED_STOCK_VALUE } from '@/lib/data'
import { slugifyProduct } from '@/lib/slug'

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
  aiKnowledgeBase: string | null
  condition: string
  category: string
  image: string
  images: string[]
  images360: string[]
  colorImages: ColorVariant[] | Record<string, string[]> | null
  priceHuf: number
  priceEur: number
  discountPriceHuf: number | null
  discountPriceEur: number | null
  /** -1 = végtelen / üres mező; 0 = elfogyott; >0 = darabszám */
  stock: number | null
  variants: unknown
  isNew: boolean
  onSale: boolean
  active: boolean
  archived: boolean
  saleStartAt: string | null
  saleEndAt: string | null
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
  const [product, setProduct] = useState<Partial<Product> | null>(
    isNew ? { category: '3d-konyha', slug: '', stock: null, colorImages: [] } : null
  )
  /** Készlet mező szöveges értéke (üres = végtelen). */
  const [stockInput, setStockInput] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)

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
        if (data.product) {
          const stock = data.product.stock
          const unlimited = stock == null || stock < 0
          setStockInput(unlimited ? '' : String(stock))
          const image = cleanCdnUrl(data.product.image)
          const images = cleanCdnUrls(
            buildProductGallery(data.product.image, data.product.images)
          )
          const colorImages = normalizeColorVariants(data.product.colorImages).map((v) => ({
            ...v,
            images: cleanCdnUrls(v.images),
          }))
          setProduct({
            ...data.product,
            stock: unlimited ? null : stock,
            image,
            images,
            images360: cleanCdnUrls(data.product.images360),
            colorImages,
          })
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'Hálózati hiba.' }))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const resolveStockForSave = (): number => {
    const trimmed = stockInput.trim()
    if (!trimmed) return UNLIMITED_STOCK_VALUE
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0) return UNLIMITED_STOCK_VALUE
    return Math.floor(n)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return
    setSaving(true)
    setMessage(null)
    try {
      const url = isNew ? '/api/admin/products' : `/api/admin/products/${id}`
      const method = isNew ? 'POST' : 'PATCH'
      const colorVariants = serializeColorVariants(
        normalizeColorVariants(product.colorImages).map((v) => ({
          ...v,
          images: cleanCdnUrls(v.images),
        }))
      )
      // Egyszínű (nincs színvariáció): product.images. Színes: alaptermék / első szín galériája.
      const baseVariant = getBaseColorVariant(colorVariants)
      const cleanedImages =
        colorVariants.length === 0
          ? cleanCdnUrls(normalizeImageUrls(product.images))
          : baseVariant?.images?.length
            ? cleanCdnUrls(baseVariant.images)
            : cleanCdnUrls(
                colorVariants.find((v) => v.images.length > 0)?.images ??
                  normalizeImageUrls(product.images)
              )
      const mainImage = cleanCdnUrl(
        normalizeImageUrl(cleanedImages[0] || product.image || '')
      )
      const gallery = buildProductGallery(mainImage, cleanedImages)
      const stock = resolveStockForSave()
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
            aiKnowledgeBase: product.aiKnowledgeBase?.trim() || null,
            condition: product.condition || 'Új',
            category: product.category || '3d-konyha',
            image: mainImage,
            images: gallery,
            images360: cleanCdnUrls(normalizeImageUrls(product.images360)),
            colorImages: colorVariants.length > 0 ? colorVariants : null,
            priceHuf: product.priceHuf ?? 0,
            priceEur: product.priceEur ?? 0,
            discountPriceHuf: product.discountPriceHuf ?? undefined,
            discountPriceEur: product.discountPriceEur ?? undefined,
            stock,
            isNew: product.isNew ?? false,
            onSale: product.onSale ?? false,
            active: product.active ?? true,
            archived: product.archived ?? false,
            saleStartAt: product.saleStartAt || undefined,
            saleEndAt: product.saleEndAt || undefined,
            isColorable: false,
            type: 'stock',
            sourcingEnabled: false,
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
            aiKnowledgeBase: product.aiKnowledgeBase?.trim() || null,
            condition: product.condition ?? 'Új',
            category: product.category ?? '3d-konyha',
            image: mainImage,
            images: gallery,
            images360: cleanCdnUrls(normalizeImageUrls(product.images360)),
            colorImages: colorVariants.length > 0 ? colorVariants : null,
            priceHuf: product.priceHuf ?? 0,
            priceEur: product.priceEur ?? 0,
            discountPriceHuf: product.discountPriceHuf ?? undefined,
            discountPriceEur: product.discountPriceEur ?? undefined,
            stock,
            isNew: product.isNew ?? false,
            onSale: product.onSale ?? false,
            active: product.active ?? true,
            archived: product.archived ?? false,
            saleStartAt: product.saleStartAt || undefined,
            saleEndAt: product.saleEndAt || undefined,
            isColorable: false,
            type: 'stock',
            sourcingEnabled: false,
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
              onChange={(e) => {
                setSlugTouched(true)
                setProduct((p) => ({ ...p, slug: slugifyProduct(e.target.value) || e.target.value }))
              }}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
            <p className="mt-1 text-xs text-muted">
              URL-azonosító: csak a–z, 0–9 és kötőjel. Ékezetek automatikusan átíródnak (pl. Madáretető → madareteto).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategória</label>
            <div className="space-y-2">
              <select
                value={product?.category?.startsWith('3d-') ? '3d-nyomtatott' : (product?.category || '3d-konyha')}
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
              {(product?.category?.startsWith('3d-') || (product?.category || '3d-konyha') === '3d-nyomtatott') && (
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
            onChange={(e) => {
              const name = e.target.value
              setProduct((p) => ({
                ...p,
                name,
                ...(isNew && !slugTouched ? { slug: slugifyProduct(name) } : {}),
              }))
            }}
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
          <div>
            <label className="block text-sm font-medium mb-1">
              AI Tudásbázis / Termékspecifikációk (HU)
            </label>
            <textarea
              value={product?.aiKnowledgeBase ?? ''}
              onChange={(e) => setProduct((p) => ({ ...p, aiKnowledgeBase: e.target.value }))}
              rows={8}
              placeholder="Anyaghasználat, tisztítás, méretek, használat, GYIK…"
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
            <p className="mt-1.5 text-xs text-muted">
              Itt adhatsz meg részletes adatokat a termékről (anyaghasználat, tisztítás, méretek, használat, GYIK).
              Elég magyarul beírnod, az AI automatikusan a vásárló által használt nyelven fog válaszolni belőle!
            </p>
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
              min={0}
              value={stockInput}
              onChange={(e) => {
                const v = e.target.value
                setStockInput(v)
                if (!v.trim()) {
                  setProduct((p) => ({ ...p, stock: null }))
                  return
                }
                const n = Number(v)
                setProduct((p) => ({
                  ...p,
                  stock: Number.isFinite(n) && n >= 0 ? Math.floor(n) : null,
                }))
              }}
              placeholder="Üres = végtelen / készleten"
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
            />
            <p className="mt-1 text-xs text-muted">
              Hagyd üresen → „Készleten” (végtelen). Szám megadása → pontos darabszám (a vásárlás csökkenti).
            </p>
          </div>
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
              checked={product?.archived ?? false}
              onChange={(e) => setProduct((p) => ({ ...p, archived: e.target.checked, active: e.target.checked ? false : (p?.active ?? true) }))}
              className="rounded border-[var(--border)]"
            />
            Archivált
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
        </div>

        {product?.onSale && product?.type !== 'sourcing_deal' && (
          <div className="grid gap-4 sm:grid-cols-2 border-t border-[var(--border)] pt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Akció kezdete</label>
              <input
                value={product?.saleStartAt?.slice(0, 16) ?? ''}
                onChange={(e) => setProduct((p) => ({ ...p, saleStartAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                type="datetime-local"
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Akció vége</label>
              <input
                value={product?.saleEndAt?.slice(0, 16) ?? ''}
                onChange={(e) => setProduct((p) => ({ ...p, saleEndAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                type="datetime-local"
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
            </div>
          </div>
        )}

        <ProductColorImagesEditor
          value={normalizeColorVariants(product?.colorImages)}
          productImages={product?.images ?? []}
          onChange={({ colorImages, productImages, image }) =>
            setProduct((p) =>
              p
                ? {
                    ...p,
                    colorImages,
                    images: productImages,
                    image: image || productImages[0] || '',
                  }
                : p
            )
          }
        />

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
