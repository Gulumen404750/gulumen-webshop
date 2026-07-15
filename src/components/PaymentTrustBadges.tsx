'use client'

import { Lock, RotateCcw, Truck } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

const BADGES = [
  { key: 'payment.trustBadgeSecure', Icon: Lock },
  { key: 'payment.trustBadgeReturns', Icon: RotateCcw },
  { key: 'payment.trustBadgeShipping', Icon: Truck },
] as const

export function PaymentTrustBadges({ className = '' }: { className?: string }) {
  const { t } = useLocale()

  return (
    <ul
      className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}
      aria-label={t('payment.trustBadgesLabel')}
    >
      {BADGES.map(({ key, Icon }) => (
        <li
          key={key}
          className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-background/60 px-3 py-2.5 text-sm text-foreground"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="font-medium leading-snug">{t(key)}</span>
        </li>
      ))}
    </ul>
  )
}
