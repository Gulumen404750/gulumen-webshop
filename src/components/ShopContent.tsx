'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useMemo, useCallback, useState, useEffect } from 'react'
import { categories, mockProducts, getCategoryName, getProductName, threeDSubcategories } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { useLocale } from '@/context/LocaleContext'

const stockProducts = mockProducts.filter((p) => p.type !== 'sourcing_deal')
const threeDSlugs = threeDSubcategories.map((c) => c.slug)

type SortOption = 'newest' | 'price-asc' | 'price-desc'

/** Közelítő egyezés: tartalmazza a szöveget (normalizált, kisbetűs) vagy 1–2 karakter eltérés */
function matchesSearch(product: typeof stockProducts[0], search: string, locale: string): boolean {
  if (!search.trim()) return true
  const q = search.trim().toLowerCase().replace(/\s+/g, ' ')
  const name = getProductName(product, locale).toLowerCase()
  const desc = (product.description || '').toLowerCase()
  if (name.includes(q) || desc.includes(q)) return true
  const words = q.split(' ')
  if (words.every((w) => name.includes(w) || desc.includes(w))) return true
  if (q.length >= 3 && (name.includes(q.slice(0, -1)) || name.includes(q.slice(1)))) return true
  return false
}

export function ShopContent() {
  const { t, locale } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  const categoryParam = searchParams.get('kategoria') ?? ''
  const subParam = searchParams.get('sub') ?? ''
  const searchQuery = searchParams.get('kereses') ?? ''
  const sizeFilter = searchParams.get('size') ?? ''
  const priceMin = searchParams.get('priceMin') ?? ''
  const priceMax = searchParams.get('priceMax') ?? ''
  const conditionFilter = searchParams.get('condition') ?? ''
  const sort = (searchParams.get('sort') as SortOption) || 'newest'
  const is3DPage = categoryParam === '3d-nyomtatott'

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === '' || value === 'newest') next.delete(key)
        else next.set(key, value)
      }
      router.replace(`/termekek?${next.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )
  const setSub = useCallback(
    (sub: string) => setParams({ sub }),
    [setParams]
  )

  const filtered = useMemo(() => {
    let list = [...stockProducts]
    if (categoryParam === '3d-nyomtatott') {
      list = list.filter((p) => threeDSlugs.includes(p.category as typeof threeDSlugs[number]))
      if (subParam && threeDSlugs.includes(subParam as typeof threeDSlugs[number])) {
        list = list.filter((p) => p.category === subParam)
      }
    } else if (categoryParam) {
      list = list.filter((p) => p.category === categoryParam)
    }
    if (searchQuery) list = list.filter((p) => matchesSearch(p, searchQuery, locale))
    if (sizeFilter) {
      list = list.filter((p) =>
        p.variants?.some((v) => v.size?.toLowerCase() === sizeFilter.toLowerCase())
      )
    }
    if (priceMin) {
      const min = Number(priceMin)
      if (!Number.isNaN(min)) list = list.filter((p) => (p.discountPriceHuf ?? p.priceHuf) >= min)
    }
    if (priceMax) {
      const max = Number(priceMax)
      if (!Number.isNaN(max)) list = list.filter((p) => (p.discountPriceHuf ?? p.priceHuf) <= max)
    }
    if (conditionFilter) list = list.filter((p) => p.condition === conditionFilter)
    if (sort === 'newest') list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
    if (sort === 'price-asc') list.sort((a, b) => (a.discountPriceHuf ?? a.priceHuf) - (b.discountPriceHuf ?? b.priceHuf))
    if (sort === 'price-desc') list.sort((a, b) => (b.discountPriceHuf ?? b.priceHuf) - (a.discountPriceHuf ?? a.priceHuf))
    return list
  }, [categoryParam, subParam, searchQuery, sizeFilter, priceMin, priceMax, conditionFilter, sort, locale])

  const conditions = Array.from(new Set(stockProducts.map((p) => p.condition)))
  const sizes = Array.from(
    new Set(stockProducts.flatMap((p) => p.variants?.map((v) => v.size).filter(Boolean) ?? []))
  ).filter(Boolean) as string[]
  const cat = categoryParam ? categories.find((c) => c.slug === categoryParam) : null
  const pageTitle = cat ? getCategoryName(cat, locale) : t('pages.productsTitle')

  const INITIAL_PAGE_SIZE = 12
  const PAGE_SIZE = 12
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE)
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE)
  }, [categoryParam, subParam, searchQuery, sizeFilter, priceMin, priceMax, conditionFilter, sort])
  const visibleProducts = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  const threeDTabDesignClass = is3DPage && subParam
    ? `three-d-tab-${subParam}`
    : is3DPage
    ? 'three-d-tab-all'
    : ''

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${is3DPage ? 'three-d-page' : ''}`}>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">{pageTitle}</h1>
      {searchQuery && (
        <p className="text-muted text-sm mb-6">
          {t('common.search')}: &quot;{searchQuery}&quot;
        </p>
      )}

      {is3DPage && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setSub('')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!subParam ? 'bg-indigo-600 text-white' : 'bg-[var(--border)] text-foreground hover:bg-indigo-100 dark:hover:bg-indigo-900/30'}`}
          >
            {t('nav.allProducts')}
          </button>
          {threeDSubcategories.map((sub) => (
            <button
              key={sub.slug}
              type="button"
              onClick={() => setSub(sub.slug)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${subParam === sub.slug ? 'bg-indigo-600 text-white' : 'bg-[var(--border)] text-foreground hover:bg-indigo-100 dark:hover:bg-indigo-900/30'}`}
            >
              <span>{sub.icon}</span>
              <span>{getCategoryName(sub, locale)}</span>
            </button>
          ))}
        </div>
      )}

      <div className={`flex flex-col lg:flex-row gap-8 ${threeDTabDesignClass}`}>
        <aside className="lg:w-56 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('common.filterPrice')} (Ft)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setParams({ priceMin: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setParams({ priceMax: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                />
              </div>
            </div>
            {sizes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('common.filterSize')}</label>
                <select
                  value={sizeFilter}
                  onChange={(e) => setParams({ size: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                >
                  <option value="">{t('common.allSizes')}</option>
                  {sizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('common.filterCondition')}</label>
              <select
                value={conditionFilter}
                onChange={(e) => setParams({ condition: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              >
                <option value="">{t('common.allConditions')}</option>
                {conditions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <p className="text-muted text-sm">{t('product.productsCount', { count: filtered.length })}</p>
            <select
              value={sort}
              onChange={(e) => setParams({ sort: e.target.value })}
              className="px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground text-sm"
            >
              <option value="newest">{t('common.sortNewest')}</option>
              <option value="price-asc">{t('common.sortPriceAsc')}</option>
              <option value="price-desc">{t('common.sortPriceDesc')}</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="px-6 py-3 border-2 border-[var(--border)] text-foreground font-medium rounded-lg hover:bg-[var(--border)] transition-colors"
              >
                {t('common.loadMore') || 'Több betöltése'}
              </button>
            </div>
          )}
          {filtered.length === 0 && (
            <p className="text-muted text-center py-12">{t('common.noResults')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
