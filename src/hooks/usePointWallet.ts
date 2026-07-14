'use client'

import useSWR from 'swr'

export type PointWalletData = {
  balance: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  redeemThreshold: number
  canRedeem: boolean
  hasActiveCoupon: boolean
  activeCouponCode: string | null
  suspended: boolean
  gamificationEnabled?: boolean
  mode?: 'dev'
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch wallet')
    return res.json() as Promise<PointWalletData>
  })

export function usePointWallet(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<PointWalletData>(
    enabled ? '/api/gamification/wallet' : null,
    fetcher,
    {
      refreshInterval: 15_000,
      revalidateOnFocus: true,
    }
  )

  return {
    wallet: data,
    isLoading,
    error,
    refresh: mutate,
  }
}
