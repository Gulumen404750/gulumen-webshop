'use client'

import { useMemo } from 'react'
import { useEuroRate } from '@/context/EuroRateContext'
import { useLocale } from '@/context/LocaleContext'
import {
  formatMoneyFromHuf,
  pointsCopyVars,
  type PointsCopyVars,
} from '@/lib/display-money'

export function useDisplayMoney() {
  const { locale } = useLocale()
  const { rate, hufToEur, formatEur } = useEuroRate()

  const copy: PointsCopyVars = useMemo(() => pointsCopyVars(locale, rate), [locale, rate])

  const money = useMemo(
    () => (huf: number) => formatMoneyFromHuf(huf, locale, rate),
    [locale, rate]
  )

  return {
    locale,
    rate,
    money,
    copy,
    hufToEur,
    formatEur,
  }
}
