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
import { onLogoutCleanup } from '@/lib/logout-cleanup'
import type { Product } from '@/lib/data'
import {
  applyPendingFavoriteOverlay,
  excludeDismissedIds,
  mergeFavoriteIdsFromCache,
  nextDismissedIdsAfterToggle,
  nextFavoriteIdsAfterToggle,
} from '@/lib/wishlist-sync'

/** localStorage kulcs – kedvenc termék ID-k (oldalváltás / Vissza gomb után is). */
export const FAVORITES_STORAGE_KEY = 'gulumen_favorites'
export const FAVORITE_DISMISS_STORAGE_KEY = 'gulumen_favorite_dismissed'

type StoredFavorites = {
  userId: string
  ids: string[]
}

type WishlistContextValue = {
  productIds: string[]
  /** Alias a specifikáció szerinti névre. */
  favoriteIds: string[]
  products: Product[]
  isLoading: boolean
  isInWishlist: (productId: string) => boolean
  isDismissed: (productId: string) => boolean
  count: number
  syncFromServer: (() => void) | undefined
  /** Alias: BFCache / focus utáni újraszinkron. */
  syncFavorites: () => void
  /** Azonnali UI frissítés like/unlike kattintáskor – szerver sync csak POST után. */
  applyOptimisticToggle: (product: Product, liked: boolean) => void
  /** In-flight like: syncFromServer ne írja felül a folyamatban lévő togglet. */
  beginPendingToggle: (productId: string, liked: boolean) => void
  endPendingToggle: (productId: string) => void
  toggleFavorite: (product: Product, liked: boolean) => void
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

function getFetchOpts(): RequestInit {
  return { credentials: 'include', cache: 'no-store' }
}

function readStoredFavoriteIds(userId: string | null | undefined): string[] {
  if (typeof window === 'undefined' || !userId) return []
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredFavorites | string[]
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string')
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.userId === userId &&
      Array.isArray(parsed.ids)
    ) {
      return parsed.ids.filter((id): id is string => typeof id === 'string')
    }
    return []
  } catch {
    return []
  }
}

function writeStoredFavoriteIds(userId: string | null | undefined, ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    if (!userId) {
      localStorage.removeItem(FAVORITES_STORAGE_KEY)
      return
    }
    const payload: StoredFavorites = { userId, ids }
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* private mode / quota */
  }
}

function readStoredDismissedIds(userId: string | null | undefined): string[] {
  if (typeof window === 'undefined' || !userId) return []
  try {
    const raw = localStorage.getItem(FAVORITE_DISMISS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredFavorites
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.userId === userId &&
      Array.isArray(parsed.ids)
    ) {
      return parsed.ids.filter((id): id is string => typeof id === 'string')
    }
    return []
  } catch {
    return []
  }
}

function writeStoredDismissedIds(userId: string | null | undefined, ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    if (!userId) {
      localStorage.removeItem(FAVORITE_DISMISS_STORAGE_KEY)
      return
    }
    const payload: StoredFavorites = { userId, ids }
    localStorage.setItem(FAVORITE_DISMISS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* private mode / quota */
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { userId, authChecked } = useAuth()
  const [productIds, setProductIds] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const fetchGenRef = useRef(0)
  const hydratedUserRef = useRef<string | null>(null)
  /** productId → intended liked – megvédi az optimistic állapotot a párhuzamos GET-től. */
  const pendingToggleRef = useRef<Map<string, boolean>>(new Map())

  const beginPendingToggle = useCallback((productId: string, liked: boolean) => {
    if (!productId) return
    pendingToggleRef.current.set(productId, liked)
  }, [])

  const endPendingToggle = useCallback((productId: string) => {
    if (!productId) return
    pendingToggleRef.current.delete(productId)
  }, [])

  const applyPendingOverlay = useCallback((ids: string[]): string[] => {
    return applyPendingFavoriteOverlay(ids, pendingToggleRef.current)
  }, [])

  // Kijelentkezés: azonnali memory reset (storage-t a runLogoutCleanup törli)
  useEffect(() => {
    return onLogoutCleanup(() => {
      hydratedUserRef.current = null
      fetchGenRef.current += 1
      pendingToggleRef.current.clear()
      setProductIds([])
      setProducts([])
      setDismissedIds([])
      setIsLoading(false)
    })
  }, [])

  // localStorage azonnali hidratálás – ne villogjon üres szív visszanavigációkor
  useEffect(() => {
    if (!authChecked) return
    if (!userId) {
      hydratedUserRef.current = null
      setProductIds([])
      setProducts([])
      setDismissedIds([])
      writeStoredFavoriteIds(null, [])
      writeStoredDismissedIds(null, [])
      return
    }
    if (hydratedUserRef.current === userId) return
    hydratedUserRef.current = userId
    const dismissed = readStoredDismissedIds(userId)
    if (dismissed.length > 0) setDismissedIds(dismissed)
    const stored = excludeDismissedIds(readStoredFavoriteIds(userId), dismissed)
    if (stored.length > 0) {
      setProductIds((prev) => (prev.length > 0 ? prev : stored))
    }
  }, [userId, authChecked])

  // Persistálás minden ID-változáskor
  useEffect(() => {
    if (!authChecked || !userId) return
    writeStoredFavoriteIds(userId, productIds)
  }, [productIds, userId, authChecked])

  useEffect(() => {
    if (!authChecked || !userId) return
    writeStoredDismissedIds(userId, dismissedIds)
  }, [dismissedIds, userId, authChecked])

  const fetchWishlist = useCallback(() => {
    if (!authChecked) return

    if (!userId) {
      setProductIds([])
      setProducts([])
      setDismissedIds([])
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
        const serverIds = ids.filter((id: unknown): id is string => typeof id === 'string')
        const serverDismissed = Array.isArray(data?.dismissedIds)
          ? data.dismissedIds.filter((id: unknown): id is string => typeof id === 'string')
          : []
        const localDismissed = readStoredDismissedIds(userId)
        const nextDismissed = Array.from(new Set([...serverDismissed, ...localDismissed]))
        const nextIds = excludeDismissedIds(applyPendingOverlay(serverIds), nextDismissed)
        setDismissedIds(nextDismissed)
        setProductIds(nextIds)
        writeStoredFavoriteIds(userId, nextIds)
        writeStoredDismissedIds(userId, nextDismissed)

        const prods = Array.isArray(data?.products) ? data.products : []
        const nextProds = prods.filter(
          (p: unknown): p is Product => typeof (p as Product)?.id === 'string'
        )
        setProducts((prev) => {
          if (nextProds.length >= nextIds.length) return nextProds
          return nextIds
            .map(
              (id: string) =>
                nextProds.find((p: Product) => p.id === id) ??
                prev.find((p: Product) => p.id === id)
            )
            .filter((p: Product | undefined): p is Product => p != null)
        })
      })
      .catch(() => {
        if (gen !== fetchGenRef.current) return
        // Hiba esetén megtartjuk a meglévő / localStorage listát
        const stored = excludeDismissedIds(
          readStoredFavoriteIds(userId),
          readStoredDismissedIds(userId)
        )
        if (stored.length > 0) {
          setProductIds((prev) =>
            applyPendingOverlay(prev.length > 0 ? mergeFavoriteIdsFromCache(prev, stored) : stored)
          )
        }
      })
      .finally(() => {
        if (gen === fetchGenRef.current) setIsLoading(false)
      })
  }, [userId, authChecked, applyPendingOverlay])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const syncFromServer = useCallback(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const lastSyncAtRef = useRef(0)

  const syncFavorites = useCallback(() => {
    if (!authChecked) return
    if (!userId) {
      setProductIds([])
      setDismissedIds([])
      return
    }
    // In-flight like alatt ne mergeljünk / ne GET-eljünk – elkerüli a számláló ugrálást.
    if (pendingToggleRef.current.size > 0) return

    const now = Date.now()
    if (now - lastSyncAtRef.current < 1500) {
      // Gyors focus/pageshow: ne töltsük vissza a stale localStorage listát.
      return
    }
    lastSyncAtRef.current = now
    fetchWishlist()
  }, [authChecked, userId, fetchWishlist])

  // Böngésző Vissza (BFCache) + ablak fókusz → újraszinkron
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        syncFavorites()
      } else {
        // SPA / soft navigation visszatérés: localStorage + esetleges szerver sync
        syncFavorites()
      }
    }
    const handleFocus = () => {
      syncFavorites()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFavorites()
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [syncFavorites])

  const applyOptimisticToggle = useCallback((product: Product, liked: boolean) => {
    setProductIds((prev) => {
      const next = excludeDismissedIds(
        nextFavoriteIdsAfterToggle(prev, product.id, liked),
        liked ? [] : [product.id]
      )
      writeStoredFavoriteIds(userId, next)
      return next
    })
    setDismissedIds((prev) => {
      const next = nextDismissedIdsAfterToggle(prev, product.id, liked)
      writeStoredDismissedIds(userId, next)
      return next
    })
    if (liked) {
      setProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]))
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    }
  }, [userId])

  const isInWishlist = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  )

  const isDismissed = useCallback(
    (productId: string) => dismissedIds.includes(productId),
    [dismissedIds]
  )

  const value: WishlistContextValue = {
    productIds,
    favoriteIds: productIds,
    products,
    isLoading,
    isInWishlist,
    isDismissed,
    count: productIds.length,
    syncFromServer,
    syncFavorites,
    applyOptimisticToggle,
    beginPendingToggle,
    endPendingToggle,
    toggleFavorite: applyOptimisticToggle,
  }

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}

/** Spec szerinti alias. */
export function useFavoritesStore(): WishlistContextValue {
  return useWishlist()
}
