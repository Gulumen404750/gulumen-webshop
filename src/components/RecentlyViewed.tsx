'use client'

import { useState, useEffect } from 'react'
import { getProductById } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { useLocale } from '@/context/LocaleContext'

const STORAGE_KEY = 'gulumen-recently-viewed'
const MAX = 6

export function RecentlyViewed() {
  const { t } = useLocale()
  const [productIds, setProductIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      setProductIds(list.slice(0, MAX))
    } catch {
      setProductIds([])
    }
  }, [])

  const products = productIds.map((id) => getProductById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getProductById>>[]

  if (products.length === 0) return null

  return (
    <section className="py-16 border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-foreground mb-8">{t('product.recentlyViewed') || 'Utoljára megtekintett termékek'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
