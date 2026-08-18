'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useDisplayMoney } from '@/hooks/useDisplayMoney'
import { usePointWallet } from '@/hooks/usePointWallet'
import type { PointWalletCoupon } from '@/lib/point-wallet-client'

type Props = {
  className?: string
}

function couponStatusLabel(
  status: PointWalletCoupon['status'],
  t: (key: string) => string
) {
  if (status === 'active') return t('gamification.couponStatusActive')
  if (status === 'used') return t('gamification.couponStatusUsed')
  if (status === 'expired') return t('gamification.couponStatusExpired')
  return t('gamification.couponStatusInactive')
}

function statusClass(status: PointWalletCoupon['status']) {
  if (status === 'active') {
    return 'bg-green-600/15 text-green-700 dark:text-green-400'
  }
  if (status === 'expired') {
    return 'bg-amber-600/15 text-amber-700 dark:text-amber-400'
  }
  return 'bg-[var(--border)] text-muted'
}

export function PointsProgress({ className = '' }: Props) {
  const { isLoggedIn } = useAuth()
  const { t, locale } = useLocale()
  const { money } = useDisplayMoney()
  const { wallet, isLoading, refresh } = usePointWallet(isLoggedIn)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  if (!isLoggedIn) return null

  const balance = wallet?.balance ?? 0
  const threshold = wallet?.redeemThreshold ?? 350
  const progress = Math.min(100, Math.round((balance / threshold) * 100))
  const remaining = Math.max(0, threshold - balance)
  const coupons = wallet?.coupons ?? []
  const activeCount = coupons.filter((c) => c.status === 'active').length
  const redeemableCount = wallet?.redeemableCount ?? (wallet?.canRedeem ? 1 : 0)
  const seenCouponIds = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (isLoading && !wallet) return
    const ids = coupons.map((c) => c.id)
    if (seenCouponIds.current == null) {
      seenCouponIds.current = new Set(ids)
      return
    }
    const hasNewActive = coupons.some(
      (c) => c.status === 'active' && !seenCouponIds.current!.has(c.id)
    )
    seenCouponIds.current = new Set(ids)
    if (hasNewActive) setListOpen(true)
  }, [coupons, isLoading, wallet])

  const formatUntil = (iso: string | null) => {
    if (!iso) return t('gamification.couponNoExpiry')
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return t('gamification.couponNoExpiry')
    return d.toLocaleDateString(locale)
  }

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
      setRedeemSuccess(t('gamification.redeemSuccess', { code: data.couponCode ?? '' }))
      setListOpen(true)
      await refresh()
    } catch {
      setRedeemError(t('gamification.redeemError'))
    } finally {
      setRedeeming(false)
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`relative z-10 self-start w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ${className}`}
    >
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

      {remaining > 0 && (
        <p className="text-xs text-muted mt-2">
          {t('gamification.pointsRemaining', { count: remaining })}
        </p>
      )}

      {redeemableCount > 0 && (
        <p className="text-xs text-muted mt-2">
          {t('gamification.redeemableCountHint', { count: redeemableCount })}
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

      {wallet?.canRedeem && (
        <button
          type="button"
          onClick={() => void handleRedeem()}
          disabled={redeeming}
          className="mt-4 w-full py-2.5 px-4 bg-accent text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-60"
        >
          {redeeming ? t('gamification.redeeming') : t('gamification.redeemCta')}
        </button>
      )}

      {redeemError && <p className="text-sm text-red-600 mt-2">{redeemError}</p>}
      {redeemSuccess && <p className="text-sm text-accent mt-2">{redeemSuccess}</p>}

      {coupons.length > 0 && (
        <details
          className="relative mt-4 group"
          open={listOpen}
          onToggle={(e) => setListOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="px-3 py-2.5 text-sm font-medium text-foreground cursor-pointer list-none flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-background">
            <span>
              {t('gamification.myCouponsTitle', { count: coupons.length })}
              {activeCount > 0 ? (
                <span className="text-muted font-normal">
                  {' '}
                  · {t('gamification.myCouponsActiveCount', { count: activeCount })}
                </span>
              ) : null}
            </span>
            <span className="text-muted group-open:rotate-180 transition-transform shrink-0 text-xs">
              ▼
            </span>
          </summary>
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-[var(--border)] bg-[var(--card-bg)] shadow-lg">
            <ul className="px-3 pt-3 space-y-2">
              {coupons.map((coupon) => (
                <li
                  key={coupon.id}
                  className="rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-foreground break-all">{coupon.code}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {coupon.discountType === 'fixed'
                          ? t('gamification.couponFixed', {
                              amount: money(coupon.discountValue ?? 0),
                            })
                          : t('gamification.couponPercent', { percent: coupon.discountPercent })}
                        {' · '}
                        {t('gamification.couponValidUntil', {
                          date: formatUntil(coupon.validUntil),
                        })}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${statusClass(coupon.status)}`}
                    >
                      {couponStatusLabel(coupon.status, t)}
                    </span>
                  </div>
                  {coupon.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => void copyCode(coupon.code)}
                      className="mt-2 text-xs font-medium text-accent hover:underline"
                    >
                      {copiedCode === coupon.code
                        ? t('gamification.couponCopied')
                        : t('gamification.couponCopy')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="px-3 py-3 text-xs text-muted">{t('gamification.myCouponsCheckoutHint')}</p>
          </div>
        </details>
      )}
    </div>
  )
}
