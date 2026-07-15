'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ProductCard } from '@/components/ProductCard'
import { LuckySpinPanel } from '@/components/LuckySpinPanel'
import { WishlistEmptyState } from '@/components/empty-states/WishlistEmptyState'
import { useWishlist } from '@/context/WishlistContext'
import { useProducts } from '@/context/ProductsContext'
import { useLocale } from '@/context/LocaleContext'
import { useAuth } from '@/context/AuthContext'
import { getProductById as getProductByIdFromData, type Product } from '@/lib/data'

export default function WishlistPage() {
  const { t } = useLocale()
  const { isLoggedIn, authChecked } = useAuth()
  const { products, productIds, isLoading, syncFromServer } = useWishlist()
  const { getProductById: getProductByIdFromContext } = useProducts()

  useEffect(() => {
    syncFromServer?.()
  }, [syncFromServer])

  const displayProducts = useMemo(() => {
    const resolve = (id: string): Product | undefined =>
      products.find((p) => p.id === id) ??
      getProductByIdFromContext(id) ??
      getProductByIdFromData(id)

    return productIds
      .map((id) => resolve(id))
      .filter((p): p is Product => p != null)
  }, [productIds, products, getProductByIdFromContext])

  const showInitialLoading = !authChecked || (isLoading && productIds.length === 0)
  const showEmpty = authChecked && isLoggedIn && !isLoading && productIds.length === 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('wishlist.title') || 'Kedvencek'}</h1>
      {!authChecked ? (
        <p className="text-muted mb-4">{t('common.loading') || 'Betöltés…'}</p>
      ) : !isLoggedIn ? (
        <p className="text-muted mb-4">{t('wishlist.loginRequired') || 'Jelentkezz be a kedveléshez.'}</p>
      ) : (
        <>
          <LuckySpinPanel />
          {showInitialLoading ? (
            <p className="text-muted mb-4">{t('common.loading') || 'Betöltés…'}</p>
          ) : showEmpty ? (
            <WishlistEmptyState />
          ) : (
            <>
              {isLoading && displayProducts.length > 0 && (
                <p className="text-xs text-muted mb-3">{t('common.loading') || 'Frissítés…'}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {productIds.length > displayProducts.length && (
                <p className="text-sm text-muted mt-4">
                  {t('wishlist.partialLoad') ||
                    `${productIds.length - displayProducts.length} kedvenc termék betöltése folyamatban…`}
                </p>
              )}
            </>
          )}
        </>
      )}
      {!showEmpty && (
        <Link href="/termekek" className="inline-block mt-6 text-accent font-medium hover:underline">
          {t('buttons.browseProducts')}
        </Link>
      )}
    </div>
  )
}
