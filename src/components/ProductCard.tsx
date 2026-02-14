'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import type { Product } from '@/lib/data'
import { getSourcingDealStatus, getProductName, getStockById, is3DProduct } from '@/lib/data'
import { SourcingDealCardCountdown } from '@/components/SourcingDealCardCountdown'
import { useLocale } from '@/context/LocaleContext'
import { useEuroRate } from '@/context/EuroRateContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useWishlist } from '@/context/WishlistContext'

/** Elérhető készlet: stock = getStockById; sourcing_deal = maxOrders - ordersCount (0 ha nem vehető). */
function getAvailableStock(product: Product): number {
  if (product.type === 'sourcing_deal') {
    const status = getSourcingDealStatus(product)
    if (status === 'sale' && product.maxOrders != null) {
      return Math.max(0, product.maxOrders - (product.ordersCount ?? 0))
    }
    return 0
  }
  return getStockById(product.id)
}

function SourcingDealBadge({ product, t }: { product: Product; t: (k: string) => string }) {
  if (product.type !== 'sourcing_deal') return null
  const status = getSourcingDealStatus(product)
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

function getLikeHeaders(userId: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (userId) headers['X-User-Id'] = userId
  return headers
}

export function ProductCard({ product, sourcingListMode }: { product: Product; sourcingListMode?: boolean }) {
  const { t, locale } = useLocale()
  const { hufToEur, formatEur } = useEuroRate()
  const { userId } = useAuth()
  const { toast } = useToast()
  const { syncFromServer } = useWishlist()

  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(() => Math.max(0, product.likesCount ?? 0))
  const [likePulse, setLikePulse] = useState(false)
  const showLikes = showLikesForProduct(product)
  const availableStock = getAvailableStock(product)
  const showFomoBadge = showLikes && likesCount > 20 && availableStock < 10

  // Like állapot és számláló csak API-ból (user-specifikus liked, publikus likesCount)
  useEffect(() => {
    if (!showLikes) return
    const headers = getLikeHeaders(userId ?? null)
    fetch(`/api/products/${product.id}/like`, { headers })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (data?.likesCount != null) setLikesCount(data.likesCount)
        if (typeof data?.liked === 'boolean') setLiked(data.liked)
      })
      .catch(() => {})
  }, [product.id, showLikes, userId])

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

      const prevLiked = liked
      const prevCount = likesCount
      setLiked(!prevLiked)
      setLikesCount((c) => (prevLiked ? Math.max(0, c - 1) : c + 1))
      syncFromServer?.()

      fetch(`/api/products/${product.id}/like`, {
        method: 'POST',
        headers: getLikeHeaders(userId),
      })
        .then((r) => {
          if (r.status === 401) {
            setLiked(prevLiked)
            setLikesCount(prevCount)
            toast(t('wishlist.loginRequired') || 'Jelentkezz be a kedveléshez.')
            return null
          }
          return r.json()
        })
        .then((data) => {
          if (data?.likesCount != null) setLikesCount(data.likesCount)
          if (typeof data?.liked === 'boolean') setLiked(data.liked)
          syncFromServer?.()
        })
        .catch(() => {
          setLiked(prevLiked)
          setLikesCount(prevCount)
          syncFromServer?.()
        })
    },
    [product.id, userId, liked, likesCount, toast, t, syncFromServer]
  )

  const priceHuf = product.discountPriceHuf ?? product.priceHuf
  const priceEur = hufToEur(priceHuf)
  const hasDiscount = !!product.discountPriceHuf
  const hasImage = product.image?.startsWith('/')
  const displayName = getProductName(product, locale)
  const likesGlow = likesCount > 25 ? 'product-likes-glow-strong' : likesCount > 10 ? 'product-likes-glow' : ''

  return (
    <Link href={`/termek/${product.slug}`} className="group block">
      <article className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden transition-shadow hover:shadow-lg">
        <div className="aspect-square bg-[var(--border)] relative overflow-hidden">
          {hasImage ? (
            <Image src={product.image} alt={displayName} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-muted text-sm">
              {t('product.noImage')}
            </div>
          )}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={onWishlistLikeClick}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 transition-shadow duration-200 ${likePulse ? 'product-like-pulse' : ''} ${showLikes ? likesGlow : ''}`}
              aria-label={liked ? (t('wishlist.remove') || 'Eltávolítás a kedvencekből') : (t('wishlist.add') || 'Kedvencekhez')}
              title={showLikes ? (t('product.likesCount', { count: likesCount }) || '') : undefined}
            >
              <HeartIcon filled={liked} className={`w-5 h-5 shrink-0 ${liked ? 'text-red-500' : 'text-muted'}`} />
              {showLikes && (
                <span className="text-sm font-semibold tabular-nums text-foreground min-w-[1.25rem] text-center">{likesCount}</span>
              )}
            </button>
          </div>
          {product.type === 'sourcing_deal' && <SourcingDealBadge product={product} t={t} />}
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
          {product.onSale && product.type !== 'sourcing_deal' && !is3DProduct(product) && (
            <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-discount text-white rounded">
              {t('status.deal')}
            </span>
          )}
          {product.isNew && !product.onSale && product.type !== 'sourcing_deal' && !is3DProduct(product) && (
            <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-accent text-white rounded">
              {t('status.new')}
            </span>
          )}
        </div>
        {product.type === 'sourcing_deal' && (
          <SourcingDealCardCountdown product={product} />
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
          {product.type === 'sourcing_deal' ? (
            <p className="mt-0.5 text-xs text-muted">{t('product.sourcingCardLabel')}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted">{t('product.stockLabel')}</p>
          )}
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
