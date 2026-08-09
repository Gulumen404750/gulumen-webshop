'use client'

import useSWR from 'swr'

export type LuckySpinProduct = {
  id: string
  slug: string
  name: string
  image: string
  priceHuf: number
  discountPriceHuf?: number | null
}

export type LuckySpinData = {
  spin: {
    id: string
    weekId: string
    productIds: string[]
    generatedAt: string
    expiresAt: string
    products: LuckySpinProduct[]
  } | null
  spinResult?: {
    productIds: string[]
    products: LuckySpinProduct[]
    expiresAt: string
  } | null
  canSpin: boolean
  nextSpinAt: string | null
  isActive: boolean
  isExpired: boolean
  likesCount: number
  isEligible: boolean
  created?: boolean
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (res.status === 401) return null
    if (!res.ok) throw new Error('Failed to fetch lucky spin')
    return res.json() as Promise<LuckySpinData>
  })

export function useLuckySpin(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<LuckySpinData | null>(
    enabled ? '/api/gamification/spin' : null,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true }
  )

  const spinWheel = async (): Promise<LuckySpinData | null> => {
    const res = await fetch('/api/gamification/spin', {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? 'Spin failed')
    }
    const json = (await res.json()) as LuckySpinData
    await mutate(json, { revalidate: false })
    return json
  }

  return {
    data,
    isLoading,
    error,
    refresh: mutate,
    spinWheel,
  }
}
