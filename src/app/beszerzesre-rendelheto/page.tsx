'use client'

import { getSourcingDealProducts } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { useLocale } from '@/context/LocaleContext'

export default function BeszerzesreRendelhetoPage() {
  const { t } = useLocale()
  const all = getSourcingDealProducts()
  const now = Date.now()
  const products = [...all].sort((a, b) => {
    const tA = new Date(a.saleTo ?? 0).getTime()
    const tB = new Date(b.saleTo ?? 0).getTime()
    const aExpired = tA < now
    const bExpired = tB < now
    if (aExpired && !bExpired) return 1
    if (!aExpired && bExpired) return -1
    return tA - tB
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">{t('sourcing.title')}</h1>
      <p className="text-muted mb-8">{t('sourcing.intro')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} sourcingListMode />
        ))}
      </div>
      {products.length === 0 && (
        <p className="text-muted text-center py-12">{t('sourcing.noOffers')}</p>
      )}
    </div>
  )
}
