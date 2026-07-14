'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { usePointWallet } from '@/hooks/usePointWallet'

type Props = {
  className?: string
}

export function PointsProgress({ className = '' }: Props) {
  const { isLoggedIn } = useAuth()
  const { t } = useLocale()
  const { wallet, isLoading, refresh } = usePointWallet(isLoggedIn)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null)

  if (!isLoggedIn) return null

  const balance = wallet?.balance ?? 0
  const threshold = wallet?.redeemThreshold ?? 350
  const progress = Math.min(100, Math.round((balance / threshold) * 100))
  const remaining = Math.max(0, threshold - balance)

  const handleRedeem = async () => {
    setRedeemError(null)
    setRedeemSuccess(null)
    setRedeeming(true)
    try {
      const res = await fetch('/api/gamification/redeem', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRedeemError(data.message || t('gamification.redeemError'))
        return
      }
      setRedeemSuccess(
        t('gamification.redeemSuccess').replace('{code}', data.couponCode ?? '')
      )
      await refresh()
    } catch {
      setRedeemError(t('gamification.redeemError'))
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">{t('gamification.progressTitle')}</p>
        <span className="text-sm text-muted">
          {isLoading ? '…' : `${balance} / ${threshold}`}
        </span>
      </div>

      <div
        className="h-3 w-full rounded-full bg-[var(--border)] overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('gamification.progressTitle')}
      >
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {remaining > 0 && !wallet?.hasActiveCoupon && (
        <p className="text-xs text-muted mt-2">
          {t('gamification.pointsRemaining').replace('{count}', String(remaining))}
        </p>
      )}

      {wallet?.mode === 'dev' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          {t('gamification.devModeNote')}
        </p>
      )}

      <p className="text-xs text-muted mt-2 italic">
        {t('gamification.processingNote')}
      </p>

      {wallet?.hasActiveCoupon && wallet.activeCouponCode && (
        <p className="text-sm text-accent mt-3">
          {t('gamification.activeCoupon').replace('{code}', wallet.activeCouponCode)}
        </p>
      )}

      {wallet?.canRedeem && (
        <button
          type="button"
          onClick={handleRedeem}
          disabled={redeeming}
          className="mt-4 w-full py-2.5 px-4 bg-accent text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
        >
          {redeeming ? t('gamification.redeeming') : t('gamification.redeemCta')}
        </button>
      )}

      {redeemError && <p className="text-sm text-red-600 mt-2">{redeemError}</p>}
      {redeemSuccess && <p className="text-sm text-accent mt-2">{redeemSuccess}</p>}
    </div>
  )
}
