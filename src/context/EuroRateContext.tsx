'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { fetchEuroToHufRate, hufToEur, formatEur, FALLBACK_HUF_PER_EUR } from '@/lib/euro-rate'

type EuroRateContextValue = {
  /** HUF per 1 EUR (aktuális árfolyam). */
  rate: number
  /** Az árfolyam betöltve (API vagy fallback). */
  loaded: boolean
  /** HUF → EUR (megjelenítéshez). */
  hufToEur: (huf: number) => number
  /** EUR összeg formázva (pl. "31,50"). */
  formatEur: (value: number) => string
  /** Újratölti az árfolyamot (pl. 1 óránként). */
  refresh: () => Promise<void>
}

const EuroRateContext = createContext<EuroRateContextValue | null>(null)

const REFRESH_INTERVAL_MS = 60 * 60 * 1000 // 1 óra

export function EuroRateProvider({ children }: { children: ReactNode }) {
  const [rate, setRate] = useState(FALLBACK_HUF_PER_EUR)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const result = await fetchEuroToHufRate()
    setRate(result.rate)
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const value: EuroRateContextValue = useMemo(
    () => ({
      rate,
      loaded,
      hufToEur: (huf: number) => hufToEur(huf, rate),
      formatEur,
      refresh,
    }),
    [rate, loaded, refresh]
  )

  return <EuroRateContext.Provider value={value}>{children}</EuroRateContext.Provider>
}

export function useEuroRate(): EuroRateContextValue {
  const ctx = useContext(EuroRateContext)
  if (!ctx) throw new Error('useEuroRate must be used within EuroRateProvider')
  return ctx
}
