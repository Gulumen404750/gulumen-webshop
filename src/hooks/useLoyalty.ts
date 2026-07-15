'use client'

import useSWR from 'swr'
import type { LoyaltyTier } from '@/lib/loyalty'

export type LoyaltyData = {
  loyaltyPercent: number
  qualifyingPaidOrdersCount: number
  tier: LoyaltyTier | null
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch loyalty')
    return res.json() as Promise<LoyaltyData>
  })

export function useLoyalty(email: string | null | undefined) {
  const { data, error, isLoading } = useSWR<LoyaltyData>(
    email ? `/api/loyalty?email=${encodeURIComponent(email)}` : null,
    fetcher,
    { revalidateOnFocus: true }
  )

  return {
    loyalty: data,
    isLoading,
    error,
  }
}
