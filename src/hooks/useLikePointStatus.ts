'use client'

import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'

export type LikePointStatus = {
  qualifyingLikeCount: number
  qualifyingLikeTarget: number
  pointLimitReached: boolean
  canEarnLikeProgress: boolean
  windowResetsAt: string | null
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch like status')
    return res.json() as Promise<LikePointStatus>
  })

export function useLikePointStatus() {
  const { isLoggedIn } = useAuth()
  const { data, mutate } = useSWR<LikePointStatus>(
    isLoggedIn ? '/api/gamification/like-status' : null,
    fetcher,
    { refreshInterval: 60_000 }
  )

  return {
    status: data,
    refresh: mutate,
    pointLimitReached: data?.pointLimitReached ?? false,
  }
}
