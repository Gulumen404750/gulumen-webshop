'use client'

import {
  DAILY_LIKE_TARGET,
  POINTS_BROWSE_5MIN,
  POINTS_DAILY_LIKE_BONUS,
  REDEEM_THRESHOLD_MIN,
  REDEEM_COUPON_PERCENT,
  COUPON_VALIDITY_DAYS,
  BROWSE_DAILY_TARGET_SECONDS,
  BROWSE_DAILY_MAX_BONUSES,
  BROWSE_BONUS_COOLDOWN_MS,
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
  LIKE_BONUS_WINDOW_MS,
} from '@/lib/gamification/constants'
import { Sparkles, Heart, Clock, Gift, ShoppingBag } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

type Props = {
  className?: string
}

const browseMinutes = BROWSE_DAILY_TARGET_SECONDS / 60
const browseCooldownHours = BROWSE_BONUS_COOLDOWN_MS / (60 * 60 * 1000)
const likeWindowHours = LIKE_BONUS_WINDOW_MS / (60 * 60 * 1000)

export function PointsGuide({ className = '' }: Props) {
  const { t } = useLocale()

  const replace = (key: string, vars: Record<string, string | number>) => {
    let text = t(key)
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v))
    }
    return text
  }

  const steps = [
    {
      icon: Clock,
      title: t('gamification.mechanicsBrowseTitle'),
      text: replace('gamification.mechanicsBrowse', {
        minutes: browseMinutes,
        points: POINTS_BROWSE_5MIN,
        maxPerDay: BROWSE_DAILY_MAX_BONUSES,
        cooldownHours: browseCooldownHours,
      }),
    },
    {
      icon: Heart,
      title: t('gamification.mechanicsLikesTitle'),
      text: replace('gamification.mechanicsLikes', {
        count: DAILY_LIKE_TARGET,
        points: POINTS_DAILY_LIKE_BONUS,
        hours: likeWindowHours,
      }),
    },
    {
      icon: ShoppingBag,
      title: t('gamification.mechanicsPurchaseTitle'),
      text: replace('gamification.mechanicsPurchase', {
        percent: Math.round(MAX_CART_POINTS_COVERAGE * 100),
        rate: POINTS_PER_HUF,
      }),
    },
    {
      icon: Gift,
      title: t('gamification.mechanicsRedeemTitle'),
      text: replace('gamification.mechanicsRedeem', {
        threshold: REDEEM_THRESHOLD_MIN,
        discount: REDEEM_COUPON_PERCENT,
        days: COUPON_VALIDITY_DAYS,
      }),
    },
  ]

  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5 sm:p-6 ${className}`}
      aria-labelledby="points-guide-title"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-accent shrink-0" aria-hidden />
        <h2 id="points-guide-title" className="font-heading text-lg font-semibold text-foreground">
          {t('gamification.mechanicsTitle')}
        </h2>
      </div>
      <p className="text-sm text-muted mb-5">{t('gamification.mechanicsIntro')}</p>

      <ul className="space-y-4">
        {steps.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted mt-0.5">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted mt-5 pt-4 border-t border-[var(--border)]">
        {t('gamification.mechanicsReset')}
      </p>
    </section>
  )
}
