'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { categories, mockProducts, getCategoryName } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { useLocale } from '@/context/LocaleContext'

const stockProducts = mockProducts.filter((p) => p.type !== 'sourcing_deal')

type SortOption = 'newest' | 'price-asc' | 'price-desc'

export function ShopContent() {
  const { t, locale } = useLocale()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('kategoria') ?? ''
  const [sizeFilter, setSizeFilter] = useState<string>('')
  const [priceMin, setPriceMin] = useState<string>('')
  const [priceMax, setPriceMax] = useState<string>('')
  const [conditionFilter, setConditionFilter] = useState<string>('')
  const [sort, setSort] = useState<SortOption>('newest')

  const filtered = useMemo(() => {
    let list = [...stockProducts]
    if (categoryParam) list = list.filter((p) => p.category === categoryParam)
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
  }, [categoryParam, sizeFilter, priceMin, priceMax, conditionFilter, sort])

  const conditions = Array.from(new Set(stockProducts.map((p) => p.condition)))
  const sizes = Array.from(
    new Set(stockProducts.flatMap((p) => p.variants?.map((v) => v.size).filter(Boolean) ?? []))
  ).filter(Boolean) as string[]
  const cat = categoryParam ? categories.find((c) => c.slug === categoryParam) : null
  const pageTitle = cat ? getCategoryName(cat, locale) : t('pages.productsTitle')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-8">{pageTitle}</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('common.filterPrice')} (Ft)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                />
              </div>
            </div>
            {sizes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('common.filterSize')}</label>
                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
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
                onChange={(e) => setConditionFilter(e.target.value)}
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
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground text-sm"
            >
              <option value="newest">{t('common.sortNewest')}</option>
              <option value="price-asc">{t('common.sortPriceAsc')}</option>
              <option value="price-desc">{t('common.sortPriceDesc')}</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-muted text-center py-12">{t('common.noResults')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
