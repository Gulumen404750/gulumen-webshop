'use client'

import { useState } from 'react'
import { Clock, Heart, Gift, RotateCcw, Sparkles } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { usePointHistory } from '@/hooks/usePointHistory'
import type { LucideIcon } from 'lucide-react'

type Props = {
  className?: string
}

/** Alapértelmezett látható tételek a ponttörténetben. */
export const POINT_HISTORY_PREVIEW_LIMIT = 3

const LOCALE_MAP: Record<string, string> = {
  hu: 'hu-HU',
  en: 'en-GB',
  de: 'de-DE',
  ro: 'ro-RO',
}

function getTypeMeta(
  type: string,
  t: (key: string) => string
): { label: string; icon: LucideIcon } {
  switch (type) {
    case 'BROWSE_5MIN':
      return { label: t('gamification.historyTypeBrowse'), icon: Clock }
    case 'LIKE_DAILY_BONUS':
      return { label: t('gamification.historyTypeLike'), icon: Heart }
    case 'REDEEM_COUPON':
      return { label: t('gamification.historyTypeRedeem'), icon: Gift }
    case 'NFC_GIFT':
    case 'GIFT_POINT_CLAIM':
      return { label: t('gamification.historyTypeGift'), icon: Gift }
    case 'PURCHASE_REDEEM':
      return { label: t('gamification.historyTypePurchase'), icon: Sparkles }
    case 'PURCHASE_EARN':
      return { label: t('gamification.historyTypePurchaseEarn'), icon: Sparkles }
    case 'REVERSAL':
      return { label: t('gamification.historyTypeReversal'), icon: RotateCcw }
    default:
      return { label: t('gamification.historyTypeOther'), icon: Sparkles }
  }
}

export function PointHistoryTimeline({ className = '' }: Props) {
  const { isLoggedIn } = useAuth()
  const { t, locale } = useLocale()
  const { transactions, isLoading, mode } = usePointHistory(isLoggedIn)
  const [expanded, setExpanded] = useState(false)

  if (!isLoggedIn) return null

  const dateFormatter = new Intl.DateTimeFormat(LOCALE_MAP[locale] ?? 'hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <section className={`rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ${className}`}>
      <h2 className="font-heading text-lg font-semibold text-foreground mb-4">
        {t('gamification.historyTitle')}
      </h2>

      {isLoading ? (
        <p className="text-sm text-muted">{t('gamification.historyLoading')}</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted">{t('gamification.historyEmpty')}</p>
      ) : (
        <>
          <ol className="relative space-y-0">
            {(expanded ? transactions : transactions.slice(0, POINT_HISTORY_PREVIEW_LIMIT)).map(
              (entry, index, visible) => {
                const { label, icon: Icon } = getTypeMeta(entry.type, t)
                const isPositive = entry.delta > 0
                const isLast = index === visible.length - 1

                return (
                  <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {!isLast && (
                      <span
                        className="absolute left-[15px] top-8 bottom-0 w-px bg-[var(--border)]"
                        aria-hidden
                      />
                    )}
                    <span
                      className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-background text-muted"
                      aria-hidden
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="font-medium text-foreground">{label}</p>
                        <time className="text-xs text-muted" dateTime={entry.createdAt}>
                          {dateFormatter.format(new Date(entry.createdAt))}
                        </time>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span
                          className={
                            isPositive
                              ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                              : 'font-semibold text-red-600 dark:text-red-400'
                          }
                        >
                          {isPositive ? `+${entry.delta}` : entry.delta}{' '}
                          <span className="font-normal text-muted">{t('gamification.pointsUnit')}</span>
                        </span>
                        <span className="text-muted">
                          {t('gamification.historyBalanceAfter').replace(
                            '{balance}',
                            String(entry.balanceAfter)
                          )}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              }
            )}
          </ol>
          {transactions.length > POINT_HISTORY_PREVIEW_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="mt-4 w-full sm:w-auto px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-foreground hover:bg-[var(--border)]/50 transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? t('gamification.historyCollapse') : t('gamification.historyExpand')}
            </button>
          )}
        </>
      )}

      {mode === 'dev' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
          {t('gamification.historyDevNote')}
        </p>
      )}
    </section>
  )
}
