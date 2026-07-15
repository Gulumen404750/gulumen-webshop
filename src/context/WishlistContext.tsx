'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useAuth } from '@/context/AuthContext'
import type { Product } from '@/lib/data'

type WishlistContextValue = {
  productIds: string[]
  products: Product[]
  isLoading: boolean
  isInWishlist: (productId: string) => boolean
  count: number
  syncFromServer: (() => void) | undefined
  /** Azonnali UI frissítés like/unlike kattintáskor – szerver sync csak POST után. */
  applyOptimisticToggle: (product: Product, liked: boolean) => void
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

function getFetchOpts(): RequestInit {
  return { credentials: 'include' }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { userId, authChecked } = useAuth()
  const [productIds, setProductIds] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const fetchGenRef = useRef(0)

  const fetchWishlist = useCallback(() => {
    if (!authChecked) return

    if (!userId) {
      setProductIds([])
      setProducts([])
      setIsLoading(false)
      return
    }

    const gen = ++fetchGenRef.current
    setIsLoading(true)

    fetch('/api/me/wishlist', getFetchOpts())
      .then(async (r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (gen !== fetchGenRef.current) return
        if (data == null) return

        const ids = Array.isArray(data?.productIds) ? data.productIds : []
        const nextIds = ids.filter((id: unknown): id is string => typeof id === 'string')
        setProductIds(nextIds)

        const prods = Array.isArray(data?.products) ? data.products : []
        const nextProds = prods.filter(
          (p: unknown): p is Product => typeof (p as Product)?.id === 'string'
        )
        setProducts((prev) => {
          if (nextProds.length >= nextIds.length) return nextProds
          return nextIds
            .map(
              (id: string) =>
                nextProds.find((p) => p.id === id) ?? prev.find((p) => p.id === id)
            )
            .filter((p): p is Product => p != null)
        })
      })
      .catch(() => {
        if (gen !== fetchGenRef.current) return
        // Hiba esetén megtartjuk a meglévő listát – ne villogjon üresre
      })
      .finally(() => {
        if (gen === fetchGenRef.current) setIsLoading(false)
      })
  }, [userId, authChecked])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const syncFromServer = useCallback(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const applyOptimisticToggle = useCallback((product: Product, liked: boolean) => {
    if (liked) {
      setProductIds((prev) => (prev.includes(product.id) ? prev : [...prev, product.id]))
      setProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]))
    } else {
      setProductIds((prev) => prev.filter((id) => id !== product.id))
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    }
  }, [])

  const isInWishlist = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  )

  const value: WishlistContextValue = {
    productIds,
    products,
    isLoading,
    isInWishlist,
    count: productIds.length,
    syncFromServer,
    applyOptimisticToggle,
  }

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}
