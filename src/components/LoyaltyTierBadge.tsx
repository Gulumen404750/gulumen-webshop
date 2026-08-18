'use client'

import { Medal } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { useLoyalty } from '@/hooks/useLoyalty'
import type { LoyaltyTier } from '@/lib/loyalty'

type Props = {
  email: string
  className?: string
}

const TIER_STYLES: Record<
  LoyaltyTier,
  { badge: string; ring: string; percent: string }
> = {
  bronze: {
    badge: 'bg-gradient-to-br from-amber-700 to-orange-900 text-amber-50',
    ring: 'ring-amber-600/30',
    percent: 'text-amber-700 dark:text-amber-400',
  },
  silver: {
    badge: 'bg-gradient-to-br from-slate-400 to-slate-600 text-white',
    ring: 'ring-slate-400/30',
    percent: 'text-slate-600 dark:text-slate-300',
  },
  gold: {
    badge: 'bg-gradient-to-br from-yellow-400 to-amber-600 text-amber-950',
    ring: 'ring-yellow-500/30',
    percent: 'text-yellow-600 dark:text-yellow-400',
  },
}

export function LoyaltyTierBadge({ email, className = '' }: Props) {
  const { t } = useLocale()
  const { loyalty, isLoading } = useLoyalty(email)

  if (isLoading) return null

  const loyaltyPercent = loyalty?.loyaltyPercent ?? 0
  const qualifyingPaidOrdersCount = loyalty?.qualifyingPaidOrdersCount ?? 0
  const tier = loyalty?.tier ?? null
  const how = t('profile.loyaltyHowItWorks')

  if (!tier || loyaltyPercent <= 0) {
    return (
      <div
        className={`rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ${className}`}
      >
        <p className="font-heading text-sm font-semibold text-foreground">
          {t('profile.loyaltyEmptyTitle')}
        </p>
        <p className="text-sm text-muted mt-1">{how}</p>
      </div>
    )
  }

  const styles = TIER_STYLES[tier]
  const tierLabel = t(`profile.loyaltyTier${tier.charAt(0).toUpperCase()}${tier.slice(1)}`)

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ring-1 ${styles.ring} ${className}`}
    >
      <div
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm ${styles.badge}`}
      >
        <Medal className="h-4 w-4 shrink-0" aria-hidden />
        <span>{tierLabel}</span>
      </div>

      <div className="min-w-0">
        <p className={`font-heading text-3xl font-bold leading-none ${styles.percent}`}>
          {loyaltyPercent}%
        </p>
        <p className="text-sm text-muted mt-1">
          {t('profile.loyaltyDiscountLabel').replace('{percent}', String(loyaltyPercent))}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {t('profile.loyaltyQualifiedOrders').replace(
            '{count}',
            String(qualifyingPaidOrdersCount)
          )}
        </p>
        <p className="text-xs text-muted mt-1">{how}</p>
      </div>
    </div>
  )
}
