'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'

/**
 * Kedvencek lista privát: csak API-ból (GET /api/me/wishlist), userId alapján.
 * Nincs localStorage – különböző user külön listát lát.
 */
type WishlistContextValue = {
  productIds: string[]
  isInWishlist: (productId: string) => boolean
  count: number
  syncFromServer: (() => void) | undefined
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

/** Session cookie automatikusan megy; csak credentials kell. */
function getFetchOpts(): RequestInit {
  return { credentials: 'include' }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [productIds, setProductIds] = useState<string[]>([])

  const fetchWishlist = useCallback(() => {
    if (!userId) {
      setProductIds([])
      return
    }
    fetch('/api/me/wishlist', getFetchOpts())
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const ids = Array.isArray(data?.productIds) ? data.productIds : []
        setProductIds(ids.filter((id: unknown): id is string => typeof id === 'string'))
      })
      .catch(() => setProductIds([]))
  }, [userId])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const syncFromServer = useCallback(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const isInWishlist = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  )

  const value: WishlistContextValue = {
    productIds,
    isInWishlist,
    count: productIds.length,
    syncFromServer,
  }

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}
