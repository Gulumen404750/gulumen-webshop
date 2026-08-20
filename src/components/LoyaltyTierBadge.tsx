'use client'

import type { CSSProperties } from 'react'
import { HelpCircle, Trophy } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { useLoyalty } from '@/hooks/useLoyalty'
import { useDisplayMoney } from '@/hooks/useDisplayMoney'
import {
  LOYALTY_DISPLAY_TIERS,
  getLoyaltyDisplayTier,
  type LoyaltyDisplayTier,
} from '@/lib/loyalty'

type Props = {
  email: string
  className?: string
}

type TierStyle = {
  badge: string
  ring: string
  percent: string
  glow: string
  glowStrong: string
}

const TIER_STYLES: Record<LoyaltyDisplayTier, TierStyle> = {
  mystery: {
    badge:
      'bg-gradient-to-br from-slate-800 via-slate-900 to-black text-slate-300 border border-dashed border-slate-500/70',
    ring: 'ring-slate-500/25',
    percent: 'text-slate-400',
    glow: 'rgba(100, 116, 139, 0.45)',
    glowStrong: 'rgba(148, 163, 184, 0.55)',
  },
  copper: {
    badge: 'bg-gradient-to-br from-orange-700 to-amber-950 text-orange-50',
    ring: 'ring-orange-700/35',
    percent: 'text-orange-700 dark:text-orange-400',
    glow: 'rgba(194, 65, 12, 0.5)',
    glowStrong: 'rgba(234, 88, 12, 0.55)',
  },
  silver: {
    badge: 'bg-gradient-to-br from-slate-300 to-slate-600 text-white',
    ring: 'ring-slate-400/35',
    percent: 'text-slate-600 dark:text-slate-300',
    glow: 'rgba(148, 163, 184, 0.55)',
    glowStrong: 'rgba(226, 232, 240, 0.5)',
  },
  gold: {
    badge: 'bg-gradient-to-br from-yellow-400 to-amber-600 text-amber-950',
    ring: 'ring-yellow-500/35',
    percent: 'text-yellow-600 dark:text-yellow-400',
    glow: 'rgba(245, 158, 11, 0.55)',
    glowStrong: 'rgba(252, 211, 77, 0.65)',
  },
  platinum: {
    badge: 'bg-gradient-to-br from-slate-100 via-cyan-100 to-slate-400 text-slate-800',
    ring: 'ring-cyan-200/40',
    percent: 'text-cyan-700 dark:text-cyan-300',
    glow: 'rgba(165, 243, 252, 0.5)',
    glowStrong: 'rgba(224, 242, 254, 0.6)',
  },
  diamond: {
    badge: 'bg-gradient-to-br from-sky-200 via-cyan-300 to-indigo-500 text-indigo-950',
    ring: 'ring-cyan-400/40',
    percent: 'text-cyan-600 dark:text-cyan-300',
    glow: 'rgba(34, 211, 238, 0.55)',
    glowStrong: 'rgba(125, 211, 252, 0.7)',
  },
}

function tierLabelKey(tier: LoyaltyDisplayTier): string {
  return `profile.loyaltyTier${tier.charAt(0).toUpperCase()}${tier.slice(1)}`
}

export function LoyaltyTierBadge({ email, className = '' }: Props) {
  const { t } = useLocale()
  const { loyalty, isLoading } = useLoyalty(email)
  const { copy } = useDisplayMoney()

  if (isLoading) return null

  const loyaltyPercent = loyalty?.loyaltyPercent ?? 0
  const qualifyingPaidOrdersCount = loyalty?.qualifyingPaidOrdersCount ?? 0
  const displayTier = getLoyaltyDisplayTier(loyaltyPercent)
  const styles = TIER_STYLES[displayTier]
  const tierLabel = t(tierLabelKey(displayTier))
  const how = t('profile.loyaltyHowItWorks', copy)
  const currentIndex = LOYALTY_DISPLAY_TIERS.indexOf(displayTier)

  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ring-1 ${styles.ring} ${className}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`loyalty-badge-pulse inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm ${styles.badge}`}
          style={
            {
              '--loyalty-glow': styles.glow,
              '--loyalty-glow-strong': styles.glowStrong,
            } as CSSProperties
          }
        >
          {displayTier === 'mystery' ? (
            <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Trophy className="h-4 w-4 shrink-0" aria-hidden />
          )}
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
        </div>
      </div>

      <ol className="mt-4 flex flex-wrap items-center gap-1.5" aria-label={t('profile.loyaltyRanksLabel')}>
        {LOYALTY_DISPLAY_TIERS.map((tier, index) => {
          const reached = index <= currentIndex
          const active = tier === displayTier
          const mini = TIER_STYLES[tier]
          return (
            <li key={tier}>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  active
                    ? `loyalty-badge-pulse ${mini.badge}`
                    : reached
                      ? `${mini.badge} opacity-80`
                      : 'bg-slate-900/70 text-slate-500 border border-dashed border-slate-600/80'
                }`}
                style={
                  active
                    ? ({
                        '--loyalty-glow': mini.glow,
                        '--loyalty-glow-strong': mini.glowStrong,
                      } as CSSProperties)
                    : undefined
                }
                aria-current={active ? 'true' : undefined}
              >
                {tier === 'mystery' ? (
                  <HelpCircle className="h-3 w-3 shrink-0" aria-hidden />
                ) : null}
                <span>{t(tierLabelKey(tier))}</span>
              </span>
            </li>
          )
        })}
      </ol>

      <p className="text-xs text-muted mt-3">{how}</p>
    </div>
  )
}
