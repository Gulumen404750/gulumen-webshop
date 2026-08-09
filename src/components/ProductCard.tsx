'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { Product } from '@/lib/data'
import { getSourcingDealStatus, getProductName, getDisplayStock, is3DProduct, isUnlimitedStock } from '@/lib/data'
import { SafeProductImage } from '@/components/SafeProductImage'
import { resolveImageUrl } from '@/lib/cdn'
import { SourcingDealCardCountdown } from '@/components/SourcingDealCardCountdown'
import { SaleCountdown } from '@/components/SaleCountdown'
import { SoldImpactOverlay } from '@/components/SoldImpactOverlay'
import { getSaleDiscountPercent } from '@/lib/storefront-config'
import { useSaleActive } from '@/hooks/useSaleActive'
import { useLocale } from '@/context/LocaleContext'
import { useEuroRate } from '@/context/EuroRateContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useWishlist } from '@/context/WishlistContext'
import { Lock } from 'lucide-react'

/** Elérhető készlet: stock = product.stock (getDisplayStock); sourcing_deal = maxOrders - ordersCount (0 ha nem vehető). serverNow = hydration egyezés listán. */
function getAvailableStock(product: Product, serverNow?: number): number {
  if (product.type === 'sourcing_deal') {
    const now = serverNow != null ? new Date(serverNow) : new Date()
    const status = getSourcingDealStatus(product, now, product.ordersCount)
    if (status === 'sale' && product.maxOrders != null) {
      return Math.max(0, product.maxOrders - (product.ordersCount ?? 0))
    }
    return 0
  }
  return getDisplayStock(product)
}

function SourcingDealBadge({
  product,
  t,
  serverNow,
}: {
  product: Product
  t: (k: string) => string
  serverNow?: number
}) {
  if (product.type !== 'sourcing_deal') return null
  const now = serverNow != null ? new Date(serverNow) : new Date()
  const status = getSourcingDealStatus(product, now, product.ordersCount)
  const labels: Record<string, string> = {
    preview: t('status.badgePreview'),
    sale: t('status.badgeSale'),
    soldout: t('status.badgeSoldout'),
    closed: t('status.badgeClosed'),
  }
  const label = status ? labels[status] : t('status.badgeSoon')
  const bg = !status ? 'bg-muted' : status === 'sale' ? 'bg-accent' : status === 'preview' ? 'bg-amber-500' : 'bg-muted'
  return (
    <span className={`absolute top-3 left-3 px-2 py-1 text-xs font-medium ${bg} text-white rounded`}>
      {label}
    </span>
  )
}

const showLikesForProduct = (product: Product): boolean => {
  const type = product.type ?? 'stock'
  return type === 'stock' || type === 'sourcing_deal'
}

const likeFetchOpts: RequestInit = { credentials: 'include' }

export function ProductCard({
  product,
  sourcingListMode,
  serverNow,
  expiredListMode,
  showSoldImpact,
  onExpired,
}: {
  product: Product
  sourcingListMode?: boolean
  serverNow?: number
  /** Lejárt termékek oldal: mindig "Hamarosan archiválásra kerül", nincs visszaszámláló. */
  expiredListMode?: boolean
  /** Elkelt/lejárt: kalapácsütés animáció a kép fölött. */
  showSoldImpact?: boolean
  /** Ha a visszaszámláló lejár (closed/soldout), egyszer meghívódik – lista elrejtheti a kártyát. */
  onExpired?: (productId: string) => void
}) {
  const { t, locale } = useLocale()
  const { hufToEur, formatEur } = useEuroRate()
  const { userId } = useAuth()
  const { toast } = useToast()
  const { isInWishlist, syncFromServer, applyOptimisticToggle } = useWishlist()

  /** Szív állapot: globális wishlist – nem helyi useState (Vissza gomb / remount után is helyes). */
  const isFavorite = isInWishlist(product.id)
  const [likesCount, setLikesCount] = useState(() => Math.max(0, product.likesCount ?? 0))
  const [likePulse, setLikePulse] = useState(false)
  const [pointLimitReached, setPointLimitReached] = useState(false)
  const showLikes = showLikesForProduct(product)
  const availableStock = getAvailableStock(product, serverNow)
  const showFomoBadge =
    showLikes &&
    likesCount > 20 &&
    !isUnlimitedStock(product) &&
    availableStock > 0 &&
    availableStock < 10

  // Publikus likesCount + pontlimit API-ból; liked státusz a globális store-ból jön
  useEffect(() => {
    if (!showLikes) return
    fetch(`/api/products/${product.id}/like`, likeFetchOpts)
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (data?.likesCount != null) setLikesCount(data.likesCount)
        // Ha a szerver liked=true, de a store még nem tudja (hideg betöltés), szinkronizálunk
        if (data?.liked === true && !isInWishlist(product.id)) {
          applyOptimisticToggle(product, true)
        }
        if (typeof data?.pointLimitReached === 'boolean') setPointLimitReached(data.pointLimitReached)
      })
      .catch(() => {})
    // favoriteIds változásakor ne spammeljük az API-t – csak termékváltáskor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, showLikes])

  const onWishlistLikeClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setLikePulse(true)
      setTimeout(() => setLikePulse(false), 400)

      if (!userId) {
        toast(t('wishlist.loginRequired') || 'Jelentkezz be a kedveléshez.')
        return
      }

      const prevLiked = isFavorite
      const prevCount = likesCount
      setLikesCount((c) => (prevLiked ? Math.max(0, c - 1) : c + 1))
      applyOptimisticToggle(product, !prevLiked)

      fetch(`/api/products/${product.id}/like`, {
        method: 'POST',
        ...likeFetchOpts,
      })
        .then((r) => {
          if (r.status === 401) {
            setLikesCount(prevCount)
            applyOptimisticToggle(product, prevLiked)
            toast(t('wishlist.loginRequired') || 'Jelentkezz be a kedveléshez.')
            return null
          }
          return r.json()
        })
        .then((data) => {
          if (data?.likesCount != null) setLikesCount(data.likesCount)
          if (typeof data?.liked === 'boolean') {
            applyOptimisticToggle(product, data.liked)
          }
          if (typeof data?.pointLimitReached === 'boolean') setPointLimitReached(data.pointLimitReached)
          syncFromServer?.()
        })
        .catch(() => {
          setLikesCount(prevCount)
          applyOptimisticToggle(product, prevLiked)
          syncFromServer?.()
        })
    },
    [
      product,
      userId,
      isFavorite,
      likesCount,
      toast,
      t,
      syncFromServer,
      applyOptimisticToggle,
    ]
  )

  const saleActive = useSaleActive(product)
  const priceHuf = saleActive && product.discountPriceHuf ? product.discountPriceHuf : product.priceHuf
  const priceEur = hufToEur(priceHuf)
  const hasDiscount = saleActive && !!product.discountPriceHuf
  const salePercent = saleActive ? getSaleDiscountPercent(product) : null
  const imageSrc = resolveImageUrl(product.image)
  const displayName = getProductName(product, locale)
  const likesGlow = likesCount > 25 ? 'product-likes-glow-strong' : likesCount > 10 ? 'product-likes-glow' : ''

  return (
    <Link
      href={`/termek/${product.slug}`}
      className={`group block ${showSoldImpact ? 'pointer-events-none sold-impact-card-wrapper' : ''}`}
      aria-disabled={showSoldImpact}
    >
      <article
        className={`bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-accent/25 ${showSoldImpact ? 'sold-impact-card-vanish' : ''}`}
      >
        <div className="aspect-square bg-[var(--border)] relative overflow-hidden">
          <SafeProductImage
            src={imageSrc}
            alt={displayName}
            fit="cover"
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={onWishlistLikeClick}
              className={`relative flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 transition-shadow duration-200 ${likePulse ? 'product-like-pulse' : ''} ${showLikes ? likesGlow : ''}`}
              aria-label={isFavorite ? (t('wishlist.remove') || 'Eltávolítás a kedvencekből') : (t('wishlist.add') || 'Kedvencekhez')}
              title={
                pointLimitReached && userId && !isFavorite
                  ? t('gamification.likeLimitReached')
                  : showLikes
                    ? (t('product.likesCount', { count: likesCount }) || '')
                    : undefined
              }
            >
              <HeartIcon filled={isFavorite} className={`w-5 h-5 shrink-0 ${isFavorite ? 'text-red-500' : 'text-muted'}`} />
              {pointLimitReached && userId && !isFavorite && (
                <Lock className="w-3 h-3 absolute -top-0.5 -right-0.5 text-muted bg-white dark:bg-gray-800 rounded-full p-0.5" aria-hidden />
              )}
              {showLikes && (
                <span className="text-sm font-semibold tabular-nums text-foreground min-w-[1.25rem] text-center">{likesCount}</span>
              )}
            </button>
          </div>
          {product.type === 'sourcing_deal' && <SourcingDealBadge product={product} t={t} serverNow={serverNow} />}
          {is3DProduct(product) && (
            <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-indigo-600/90 text-white rounded shadow-sm">
              🖨 {t('product.badge3D') || '3D Nyomtatott'}
            </span>
          )}
          {showFomoBadge && (
            <span className="absolute bottom-3 left-3 px-2 py-1 text-xs font-medium bg-orange-500/90 text-white rounded shadow-sm">
              🔥 {t('product.popular') || 'Népszerű termék'}
            </span>
          )}
          {saleActive && product.type !== 'sourcing_deal' && (
            <span className="absolute top-3 left-3 px-2 py-1 text-xs font-bold bg-discount text-white rounded">
              {salePercent != null ? `-${salePercent}%` : t('status.deal')}
            </span>
          )}
          {product.isNew && !saleActive && product.type !== 'sourcing_deal' && !is3DProduct(product) && (
            <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-accent text-white rounded">
              {t('status.new')}
            </span>
          )}
          {showSoldImpact && <SoldImpactOverlay label={t('status.expired')} />}
          {saleActive && product.type !== 'sourcing_deal' && (
            <SaleCountdown product={product} variant="overlay" />
          )}
        </div>
        {product.type === 'sourcing_deal' && (
          <SourcingDealCardCountdown
            product={product}
            serverNow={serverNow}
            forceArchivingSoon={expiredListMode}
            onExpired={onExpired}
          />
        )}
        <div className="p-4">
          <h3 className="font-heading font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-2">
            {displayName}
          </h3>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            {hasDiscount && (
              <span className="text-sm text-muted line-through">
                {product.priceHuf.toLocaleString('hu-HU')} Ft
              </span>
            )}
            <span className={hasDiscount ? 'text-discount font-semibold' : 'text-foreground font-semibold'}>
              {priceHuf.toLocaleString('hu-HU')} Ft
            </span>
            <span className="text-sm text-muted">
              (€{formatEur(priceEur)})
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{product.condition}</p>
          {product.type === 'sourcing_deal' && !sourcingListMode ? (
            <p className="mt-0.5 text-xs text-muted">{t('product.sourcingCardLabel')}</p>
          ) : product.type !== 'sourcing_deal' ? (
            <p className="mt-0.5 text-xs text-muted">{t('product.stockLabel')}</p>
          ) : null}
        </div>
      </article>
    </Link>
  )
}

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return filled ? (
    <svg className={`${className} text-red-500`} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ) : (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
}
