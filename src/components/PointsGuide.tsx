'use client'

import { useId, useState } from 'react'
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
  POINTS_PER_HUF,
  LIKE_BONUS_WINDOW_MS,
} from '@/lib/gamification/constants'
import { Sparkles, Heart, Clock, Gift, ShoppingBag, Wallet, Coins, ChevronDown } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { useDisplayMoney } from '@/hooks/useDisplayMoney'

type Props = {
  className?: string
}

const browseMinutes = BROWSE_DAILY_TARGET_SECONDS / 60
const browseCooldownHours = BROWSE_BONUS_COOLDOWN_MS / (60 * 60 * 1000)
const likeWindowHours = LIKE_BONUS_WINDOW_MS / (60 * 60 * 1000)

export function PointsGuide({ className = '' }: Props) {
  const { t } = useLocale()
  const { copy } = useDisplayMoney()
  const accordionId = useId()
  const [openId, setOpenId] = useState<string | null>(null)

  const replace = (key: string, vars: Record<string, string | number>) => {
    let text = t(key)
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v))
    }
    return text
  }

  const steps = [
    {
      id: 'browse',
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
      id: 'likes',
      icon: Heart,
      title: t('gamification.mechanicsLikesTitle'),
      text: replace('gamification.mechanicsLikes', {
        count: DAILY_LIKE_TARGET,
        points: POINTS_DAILY_LIKE_BONUS,
        hours: likeWindowHours,
      }),
    },
    {
      id: 'cashback',
      icon: Coins,
      title: t('gamification.mechanicsCashbackTitle'),
      text: replace('gamification.mechanicsCashback', {
        earnAmount: copy.earnAmount,
        points: 1,
      }),
    },
    {
      id: 'purchase',
      icon: ShoppingBag,
      title: t('gamification.mechanicsPurchaseTitle'),
      text: replace('gamification.mechanicsPurchase', {
        rate: POINTS_PER_HUF,
        pointValue: copy.pointValue,
        shippingThreshold: copy.shippingThreshold,
      }),
    },
    {
      id: 'gift',
      icon: Wallet,
      title: t('gamification.mechanicsGiftTitle'),
      text: replace('gamification.mechanicsGift', {
        pointValue: copy.pointValue,
      }),
    },
    {
      id: 'redeem',
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

      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {steps.map(({ id, icon: Icon, title, text }) => {
          const open = openId === id
          const panelId = `${accordionId}-${id}`
          return (
            <li key={id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 py-3 text-left"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId((current) => (current === id ? null : id))}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{title}</span>
                <span className="shrink-0 text-xs font-medium text-muted">
                  {open ? t('gamification.mechanicsLess') : t('gamification.mechanicsMore')}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
              <p
                id={panelId}
                hidden={!open}
                className="text-sm text-muted pb-3 pl-12 pr-1 leading-relaxed"
              >
                {text}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-muted mt-4">
        {t('gamification.mechanicsReset')}
      </p>
    </section>
  )
}
