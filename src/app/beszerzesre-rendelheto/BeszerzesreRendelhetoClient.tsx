'use client'

import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LocaleLink as Link } from '@/components/LocaleLink'
import { ProductCard } from '@/components/ProductCard'
import { useLocale } from '@/context/LocaleContext'
import type { Product } from '@/lib/data'

/** Drámai lejárt animáció: logó megjelenik a képen → pulzál → itt forog a logó → robbanás, majd kártya zsugorodik (~7,5 s), utána refresh. */
const SOLD_ANIMATION_DURATION_MS = 8000

const HIDDEN_EXPIRED_STORAGE_KEY = 'gulumen_sourcing_hidden_expired'

function getStoredHiddenExpiredIds(): Set<string> {
  if (typeof sessionStorage === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(HIDDEN_EXPIRED_STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function addToStoredHiddenExpiredIds(productId: string): void {
  try {
    const set = getStoredHiddenExpiredIds()
    set.add(productId)
    sessionStorage.setItem(HIDDEN_EXPIRED_STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // ignore
  }
}

type Props = { products: Product[]; serverNow?: number }

export function BeszerzesreRendelhetoClient({ products, serverNow }: Props) {
  const { t } = useLocale()
  const router = useRouter()
  const [expiredAnimatingIds, setExpiredAnimatingIds] = useState<Set<string>>(new Set())
  /** Üres kezdőérték: hydration mismatch elkerülése (szerveren nincs sessionStorage). useLayoutEffect feltölti kliensen. */
  const [clientSideHiddenExpiredIds, setClientSideHiddenExpiredIds] = useState<Set<string>>(new Set())
  const hiddenExpiredRef = useRef<Set<string>>(new Set())
  /** Első render = szerverrel azonos lista (ne szűrjünk sessionStorage alapján), így nincs hydration error. */
  const [hasMounted, setHasMounted] = useState(false)

  useLayoutEffect(() => {
    setHasMounted(true)
    const stored = getStoredHiddenExpiredIds()
    if (stored.size === 0) return
    hiddenExpiredRef.current = new Set(stored)
    setClientSideHiddenExpiredIds(stored)
  }, [])

  const onExpired = useCallback(
    (productId: string) => {
      addToStoredHiddenExpiredIds(productId)
      setExpiredAnimatingIds((prev) => new Set(prev).add(productId))
      setTimeout(() => {
        hiddenExpiredRef.current = new Set(hiddenExpiredRef.current).add(productId)
        setClientSideHiddenExpiredIds((prev) => new Set(prev).add(productId))
        router.refresh()
      }, SOLD_ANIMATION_DURATION_MS)
    },
    [router]
  )

  const productIdSet = new Set(products.map((p) => p.id))
  useEffect(() => {
    setExpiredAnimatingIds((prev) => {
      const next = new Set(prev)
      next.forEach((id) => {
        if (!productIdSet.has(id)) next.delete(id)
      })
      return next.size === prev.size ? prev : next
    })
  }, [products])

  // Hydration: első renderen ne használjunk sessionStorage-t (szerveren nincs), csak a szerver által küldött listát mutassuk.
  const displayProducts =
    !hasMounted
      ? products
      : products.filter((p) => {
          if (expiredAnimatingIds.has(p.id)) return true
          return !clientSideHiddenExpiredIds.has(p.id) && !hiddenExpiredRef.current.has(p.id)
        })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t('sourcing.title')}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs text-muted" aria-hidden>
            Korábbi ajánlatok
          </span>
          <Link
            href="/lejart-termekek"
            prefetch={false}
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md transition-all duration-200 hover:from-indigo-500 hover:to-blue-500 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-background"
          >
            Lejárt termékek
          </Link>
        </div>
      </div>
      <p className="text-muted mb-8">{t('sourcing.intro')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayProducts.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            sourcingListMode
            serverNow={serverNow}
            showSoldImpact={expiredAnimatingIds.has(p.id)}
            onExpired={onExpired}
          />
        ))}
      </div>
      {displayProducts.length === 0 && (
        <p className="text-muted text-center py-12">{t('sourcing.noOffers')}</p>
      )}
    </div>
  )
}
