'use client'

import { Sparkles } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { usePointWallet } from '@/hooks/usePointWallet'

type Props = {
  /** Kompakt megjelenítés a headerben. */
  compact?: boolean
  className?: string
}

export function PointsDisplay({ compact = false, className = '' }: Props) {
  const { isLoggedIn } = useAuth()
  const { t } = useLocale()
  const { wallet, isLoading } = usePointWallet(isLoggedIn)

  if (!isLoggedIn) return null

  const balance = wallet?.balance ?? 0
  const giftBalance = wallet?.giftBalance ?? wallet?.giftPointsAvailable ?? 0
  const activityBalance = wallet?.activityBalance ?? Math.max(0, balance - giftBalance)
  const title =
    giftBalance > 0
      ? `${t('gamification.giftBalance')}: ${giftBalance} · ${t('gamification.activityBalance')}: ${activityBalance}`
      : t('gamification.pointsTitle')

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/10 text-accent text-sm font-semibold ${className}`}
        title={title}
      >
        <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
        <span>{isLoading ? '…' : balance}</span>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ${className}`}>
      <p className="text-sm text-muted mb-1">{t('gamification.pointsTitle')}</p>
      <p className="font-heading text-3xl font-bold text-foreground">
        {isLoading ? '…' : balance}
        <span className="text-base font-normal text-muted ml-1">{t('gamification.pointsUnit')}</span>
      </p>
      {(giftBalance > 0 || activityBalance > 0) && !isLoading && (
        <div className="mt-2 space-y-0.5 text-sm text-muted">
          <p>
            {t('gamification.giftBalance')}:{' '}
            <span className="tabular-nums text-foreground">{giftBalance}</span>
          </p>
          <p>
            {t('gamification.activityBalance')}:{' '}
            <span className="tabular-nums text-foreground">{activityBalance}</span>
          </p>
        </div>
      )}
    </div>
  )
}
