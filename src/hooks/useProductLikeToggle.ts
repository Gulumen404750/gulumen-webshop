'use client'

import { useCallback, useRef, useState } from 'react'
import type { Product } from '@/lib/data'
import { useWishlist } from '@/context/WishlistContext'

export type ProductLikeToggleResult = {
  liked?: boolean
  likesCount?: number
  pointLimitReached?: boolean
}

type UseProductLikeToggleArgs = {
  product: Product
  userId: string | null | undefined
  isFavorite: boolean
  likesCount: number
  setLikesCount: React.Dispatch<React.SetStateAction<number>>
  onUnauthorized?: () => void
  onPointLimit?: (reached: boolean) => void
}

const likeFetchOpts: RequestInit = {
  credentials: 'include',
  cache: 'no-store',
  headers: { Accept: 'application/json' },
}

/**
 * Robusztus kedvelés toggle: egyidejű touch/click nem indít párhuzamos POST-ot,
 * a számláló mindig a szerver `likesCount` értékére áll be a válasz után.
 */
export function useProductLikeToggle({
  product,
  userId,
  isFavorite,
  likesCount,
  setLikesCount,
  onUnauthorized,
  onPointLimit,
}: UseProductLikeToggleArgs) {
  const { applyOptimisticToggle, beginPendingToggle, endPendingToggle, syncFromServer } =
    useWishlist()
  const inFlightRef = useRef(false)
  const requestSeqRef = useRef(0)
  const [isToggling, setIsToggling] = useState(false)

  // Legfrissebb értékek a click handlernek (stale closure elkerülése).
  const stateRef = useRef({ isFavorite, likesCount, userId, product })
  stateRef.current = { isFavorite, likesCount, userId, product }

  /** Mount GET ne írja felül a számlálót, amíg POST folyamatban van. */
  const shouldIgnoreExternalCount = useCallback(() => inFlightRef.current, [])

  const toggle = useCallback(
    (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      e?.preventDefault?.()
      e?.stopPropagation?.()

      // Dupla touch/click / race: amíg a POST fut, ignórálunk.
      if (inFlightRef.current) return

      const {
        isFavorite: likedNow,
        likesCount: countNow,
        userId: uid,
        product: prod,
      } = stateRef.current

      if (!uid) {
        onUnauthorized?.()
        return
      }

      inFlightRef.current = true
      setIsToggling(true)
      const seq = ++requestSeqRef.current
      const nextLiked = !likedNow
      const prevCount = Math.max(0, countNow)

      // Optimista UI – a válasz felülírja a szerver valós likesCount-tal.
      setLikesCount((c) => (likedNow ? Math.max(0, c - 1) : c + 1))
      beginPendingToggle(prod.id, nextLiked)
      applyOptimisticToggle(prod, nextLiked)

      fetch(`/api/products/${prod.id}/like`, {
        method: 'POST',
        ...likeFetchOpts,
      })
        .then(async (r) => {
          if (r.status === 401) {
            return { unauthorized: true as const }
          }
          if (!r.ok) {
            throw new Error(`like_failed_${r.status}`)
          }
          const data = (await r.json()) as ProductLikeToggleResult
          return { unauthorized: false as const, data }
        })
        .then((result) => {
          if (seq !== requestSeqRef.current) return

          if (result.unauthorized) {
            setLikesCount(prevCount)
            applyOptimisticToggle(prod, likedNow)
            endPendingToggle(prod.id)
            onUnauthorized?.()
            return
          }

          const data = result.data
          // Forrás: szerver. Ha nincs likesCount, visszavetünk az előzőre (ne ugráljon tovább).
          if (typeof data.likesCount === 'number' && Number.isFinite(data.likesCount)) {
            setLikesCount(Math.max(0, Math.floor(data.likesCount)))
          } else {
            setLikesCount(prevCount)
          }

          if (typeof data.liked === 'boolean') {
            applyOptimisticToggle(prod, data.liked)
            endPendingToggle(prod.id)
          } else {
            endPendingToggle(prod.id)
          }

          if (typeof data.pointLimitReached === 'boolean') {
            onPointLimit?.(data.pointLimitReached)
          }

          // Késleltetett lista-szinkron: ne ütközzön a POST válasszal / focus sync-kel.
          window.setTimeout(() => {
            if (seq === requestSeqRef.current) syncFromServer?.()
          }, 400)
        })
        .catch(() => {
          if (seq !== requestSeqRef.current) return
          setLikesCount(prevCount)
          applyOptimisticToggle(prod, likedNow)
          endPendingToggle(prod.id)
        })
        .finally(() => {
          if (seq === requestSeqRef.current) {
            inFlightRef.current = false
            setIsToggling(false)
          }
        })
    },
    [
      applyOptimisticToggle,
      beginPendingToggle,
      endPendingToggle,
      onPointLimit,
      onUnauthorized,
      setLikesCount,
      syncFromServer,
    ]
  )

  return { toggle, isToggling, shouldIgnoreExternalCount }
}

export { likeFetchOpts }
