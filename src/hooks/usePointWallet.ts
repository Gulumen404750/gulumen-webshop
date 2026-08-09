'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import {
  POINT_WALLET_SWR_KEY,
  applyPendingRedeemToWallet,
  applyStashedPointsRedeemOnce,
  type PointWalletData,
} from '@/lib/point-wallet-client'

export type { PointWalletData }

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch wallet')
  const data = (await res.json()) as PointWalletData
  // Stripe redirect / fizetés közben: ne mutassuk a régi egyenleget
  return applyPendingRedeemToWallet(data)
}

export function usePointWallet(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<PointWalletData>(
    enabled ? POINT_WALLET_SWR_KEY : null,
    fetcher,
    {
      refreshInterval: 15_000,
      revalidateOnFocus: true,
      revalidateOnMount: true,
    }
  )

  // Stripe-ról visszatérve: azonnal frissítsük a cache-t a pending levonással
  useEffect(() => {
    if (!enabled) return
    void applyStashedPointsRedeemOnce()
  }, [enabled])

  return {
    wallet: data,
    isLoading,
    error,
    refresh: mutate,
  }
}

export { POINT_WALLET_SWR_KEY }
