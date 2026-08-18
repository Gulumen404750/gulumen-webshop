'use client'

import { useDisplayMoney } from '@/hooks/useDisplayMoney'

type StorefrontPriceProps = {
  huf: number
  className?: string
  /** HU-n a Ft mellett zárójelben EUR (termékkártya / PDP). */
  hintClassName?: string
  showEuroHintOnHu?: boolean
}

/** Vásárlói ár: magyarul Ft (+ opcionális EUR), más nyelven élő EUR. */
export function StorefrontPrice({
  huf,
  className,
  hintClassName = 'text-sm text-muted',
  showEuroHintOnHu = true,
}: StorefrontPriceProps) {
  const { money, locale, formatEur, hufToEur } = useDisplayMoney()
  return (
    <>
      <span className={className}>{money(huf)}</span>
      {showEuroHintOnHu && locale === 'hu' ? (
        <span className={hintClassName}> (€{formatEur(hufToEur(huf))})</span>
      ) : null}
    </>
  )
}
