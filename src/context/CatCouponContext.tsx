'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

const STORAGE_PREFIX = 'gulumen-cat-coupon-'
const COUPON_PERCENT = 0.05

export type CatCouponStatus = 'not_claimed' | 'claimed' | 'used'

type CatCouponContextValue = {
  status: CatCouponStatus
  isDiscountActive: boolean
  activate: () => boolean
  markUsed: () => void
  discountPercent: number
}

const CatCouponContext = createContext<CatCouponContextValue | null>(null)

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function readStatus(userId: string | null): CatCouponStatus {
  if (!userId || typeof window === 'undefined') return 'not_claimed'
  const raw = localStorage.getItem(getStorageKey(userId))
  if (raw === 'claimed' || raw === 'used') return raw
  return 'not_claimed'
}

export function CatCouponProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [status, setStatus] = useState<CatCouponStatus>('not_claimed')

  useEffect(() => {
    setStatus(readStatus(userId))
  }, [userId])

  const activate = useCallback((): boolean => {
    if (!userId) return false
    const current = readStatus(userId)
    if (current !== 'not_claimed') return false
    localStorage.setItem(getStorageKey(userId), 'claimed')
    setStatus('claimed')
    return true
  }, [userId])

  const markUsed = useCallback(() => {
    if (!userId) return
    localStorage.setItem(getStorageKey(userId), 'used')
    setStatus('used')
  }, [userId])

  const isDiscountActive = status === 'claimed'
  const value: CatCouponContextValue = {
    status,
    isDiscountActive,
    activate,
    markUsed,
    discountPercent: COUPON_PERCENT,
  }

  return <CatCouponContext.Provider value={value}>{children}</CatCouponContext.Provider>
}

export function useCatCoupon(): CatCouponContextValue {
  const ctx = useContext(CatCouponContext)
  if (!ctx) throw new Error('useCatCoupon must be used within CatCouponProvider (inside AuthProvider)')
  return ctx
}
