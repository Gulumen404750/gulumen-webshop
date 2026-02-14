'use client'

import Link from 'next/link'
import { getProductById } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { useWishlist } from '@/context/WishlistContext'
import { useLocale } from '@/context/LocaleContext'

export default function WishlistPage() {
  const { t } = useLocale()
  const { productIds } = useWishlist()
  const products = productIds.map((id) => getProductById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getProductById>>[]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('wishlist.title') || 'Kedvencek'}</h1>
      {products.length === 0 ? (
        <p className="text-muted mb-4">{t('wishlist.empty') || 'Még nincs kedvenc termék.'}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
      <Link href="/termekek" className="inline-block mt-6 text-accent font-medium hover:underline">
        {t('buttons.browseProducts')}
      </Link>
    </div>
  )
}
