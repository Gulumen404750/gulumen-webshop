/**
 * Megjelenítési pénznem: HU → Ft, egyéb nyelvek → élő EUR árfolyam.
 * A pontok belső egysége továbbra is 1 pont = 1 Ft.
 */
import type { Locale } from '@/i18n/locales'
import { FALLBACK_HUF_PER_EUR, hufToEur } from '@/lib/euro-rate'
import {
  FREE_SHIPPING_THRESHOLD,
  POINTS_PER_HUF,
  PURCHASE_EARN_HUF_PER_POINT,
} from '@/lib/gamification/constants'
import { LOYALTY_THRESHOLD_HUF } from '@/lib/loyalty-constants'

export function intlLocaleFor(locale: Locale): string {
  if (locale === 'de') return 'de-DE'
  if (locale === 'ro') return 'ro-RO'
  if (locale === 'en') return 'en-GB'
  return 'hu-HU'
}

export function usesEuroCopy(locale: Locale): boolean {
  return locale !== 'hu'
}

export function resolveFxRate(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_HUF_PER_EUR
}

export function formatHufLabel(huf: number, locale: Locale = 'hu'): string {
  const n = Math.round(Number.isFinite(huf) ? huf : 0)
  return `${n.toLocaleString(intlLocaleFor(locale))} Ft`
}

export function formatEurLabel(eur: number, locale: Locale): string {
  const abs = Math.abs(eur)
  let min = 0
  let max = 2
  if (abs > 0 && abs < 0.01) {
    min = 4
    max = 4
  } else if (abs > 0 && abs < 1) {
    min = 2
    max = 2
  }
  return `€${eur.toLocaleString(intlLocaleFor(locale), {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })}`
}

/**
 * HUF összeg a felület nyelvén: magyarul Ft, idegen nyelven élő EUR.
 * 1 Ft-nyi tétel (pontárfolyam) 4 tizedesjegyig, hogy ne legyen €0.00.
 */
export function formatMoneyFromHuf(huf: number, locale: Locale, rate: number): string {
  const fx = resolveFxRate(rate)
  const amount = Number.isFinite(huf) ? huf : 0
  if (!usesEuroCopy(locale)) return formatHufLabel(amount, locale)
  const oneCentHuf = fx / 100
  if (amount !== 0 && Math.abs(amount) < oneCentHuf) {
    return formatEurLabel(amount / fx, locale)
  }
  return formatEurLabel(hufToEur(amount, fx), locale)
}

export type PointsCopyVars = {
  pointValue: string
  earnAmount: string
  shippingThreshold: string
  loyaltyThreshold: string
  rate: string
}

export function applyPointsCopyPlaceholders(
  text: string,
  locale: Locale,
  rate: number
): string {
  const vars = pointsCopyVars(locale, rate)
  let out = text
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return out
}

export function pointsCopyVars(locale: Locale, rate: number): PointsCopyVars {
  return {
    pointValue: formatMoneyFromHuf(1 / POINTS_PER_HUF, locale, rate),
    earnAmount: formatMoneyFromHuf(PURCHASE_EARN_HUF_PER_POINT, locale, rate),
    shippingThreshold: formatMoneyFromHuf(FREE_SHIPPING_THRESHOLD, locale, rate),
    loyaltyThreshold: formatMoneyFromHuf(LOYALTY_THRESHOLD_HUF, locale, rate),
    rate: String(POINTS_PER_HUF),
  }
}
