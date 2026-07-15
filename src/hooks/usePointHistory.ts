'use client'

import useSWR from 'swr'

export type PointHistoryEntry = {
  id: string
  type: string
  delta: number
  balanceAfter: number
  reason: string | null
  createdAt: string
}

type PointHistoryResponse = {
  transactions: PointHistoryEntry[]
  mode?: 'dev'
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch point history')
    return res.json() as Promise<PointHistoryResponse>
  })

export function usePointHistory(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<PointHistoryResponse>(
    enabled ? '/api/gamification/history' : null,
    fetcher,
    { revalidateOnFocus: true }
  )

  return {
    transactions: data?.transactions ?? [],
    mode: data?.mode,
    isLoading,
    error,
    refresh: mutate,
  }
}
