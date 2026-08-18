/**
 * Euró/forint árfolyam lekérése. Az eurót folyamatosan a forinthoz igazítjuk.
 * Frankfurter API (ECB alapú, ingyenes, API kulcs nélkül).
 */

const FRANKFURTER_URL = 'https://api.frankfurter.dev/latest?from=EUR&to=HUF'

/** Ha az API nem elérhető, ezt használjuk (HUF per 1 EUR). */
export const FALLBACK_HUF_PER_EUR = 395

/** Checkout / webhook / hűség: env FX, különben a fallback. */
export function getConfiguredHufPerEur(): number {
  const v = process.env.FX_HUF_PER_EUR
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : FALLBACK_HUF_PER_EUR
}

export interface EuroRateResult {
  rate: number
  date: string
  source: 'api' | 'fallback'
}

let cached: EuroRateResult | null = null
let cacheTime = 0
const CACHE_MS = 60 * 60 * 1000 // 1 óra

export async function fetchEuroToHufRate(): Promise<EuroRateResult> {
  if (cached && Date.now() - cacheTime < CACHE_MS) return cached
  try {
    const res = await fetch(FRANKFURTER_URL)
    if (!res.ok) throw new Error('Rate fetch failed')
    const data = await res.json()
    const rate = Number(data?.rates?.HUF)
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid rate')
    cached = { rate, date: data?.date ?? '', source: 'api' }
    cacheTime = Date.now()
    return cached
  } catch {
    cached = { rate: FALLBACK_HUF_PER_EUR, date: '', source: 'fallback' }
    cacheTime = Date.now()
    return cached
  }
}

/**
 * HUF összeg megjelenítési értéke euróban az aktuális árfolyam szerint.
 * rate = hány Ft = 1 EUR → eur = huf / rate
 */
export function hufToEur(huf: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) rate = FALLBACK_HUF_PER_EUR
  return Math.round((huf / rate) * 100) / 100
}

export function formatEur(value: number): string {
  return value.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
