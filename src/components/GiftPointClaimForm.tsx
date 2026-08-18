'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useDisplayMoney } from '@/hooks/useDisplayMoney'
import { POINT_WALLET_SWR_KEY } from '@/lib/point-wallet-client'
import { mutate } from 'swr'
import { writeTypedCoupon, type StoredTypedCoupon } from '@/lib/typed-coupon-storage'

export type GiftClaimSuccess = {
  kind: 'gift_points'
  points: number
  expiresAt: string
  balanceAfter: number | null
  alreadyClaimedByYou?: boolean
}

export type CouponClaimSuccess = {
  kind: 'coupon'
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderHuf: number | null
}

export type CodeRedeemSuccess = GiftClaimSuccess | CouponClaimSuccess

type Props = {
  /** Előre kitöltött token (QR /claim oldal). */
  initialToken?: string
  /** Elrejti a token mezőt, ha a token az URL-ből jön. */
  hideTokenInput?: boolean
  className?: string
  onSuccess?: (result: CodeRedeemSuccess) => void
}

export function GiftPointClaimForm({
  initialToken = '',
  hideTokenInput = false,
  className = '',
  onSuccess,
}: Props) {
  const { t, locale } = useLocale()
  const { copy, money } = useDisplayMoney()
  const { isLoggedIn, authChecked } = useAuth()
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [giftSuccess, setGiftSuccess] = useState<GiftClaimSuccess | null>(null)
  const [couponSuccess, setCouponSuccess] = useState<CouponClaimSuccess | null>(null)

  const nextPath =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/claim'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setGiftSuccess(null)
    setCouponSuccess(null)
    const trimmed = token.trim()
    if (!trimmed) {
      setError(t('giftClaim.errorRequired'))
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/codes/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setError(t('giftClaim.loginRequired'))
        return
      }
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : t('giftClaim.errorGeneric'))
        return
      }
      if (data.kind === 'coupon') {
        const result: CouponClaimSuccess = {
          kind: 'coupon',
          code: String(data.code || trimmed).toUpperCase(),
          discountType: data.discountType === 'fixed' ? 'fixed' : 'percent',
          discountValue: Number(data.discountValue) || 0,
          minOrderHuf: typeof data.minOrderHuf === 'number' ? data.minOrderHuf : null,
        }
        const stored: StoredTypedCoupon = {
          code: result.code,
          discountType: result.discountType,
          discountValue: result.discountValue,
          minOrderHuf: result.minOrderHuf,
        }
        writeTypedCoupon(stored)
        setCouponSuccess(result)
        onSuccess?.(result)
        return
      }
      const result: GiftClaimSuccess = {
        kind: 'gift_points',
        points: Number(data.points) || 0,
        expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : '',
        balanceAfter: typeof data.balanceAfter === 'number' ? data.balanceAfter : null,
        alreadyClaimedByYou: data.alreadyClaimedByYou === true,
      }
      setGiftSuccess(result)
      await mutate(POINT_WALLET_SWR_KEY)
      onSuccess?.(result)
    } catch {
      setError(t('giftClaim.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ${className}`}>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        {t('giftClaim.title')}
      </h2>
      <p className="text-sm text-muted mt-1">{t('giftClaim.hint', copy)}</p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {!hideTokenInput && (
          <label className="block">
            <span className="text-sm font-medium text-foreground">{t('giftClaim.codeLabel')}</span>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 font-mono text-foreground"
              placeholder={t('giftClaim.codePlaceholder')}
            />
          </label>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {giftSuccess && (
          <p className="text-sm text-green-700 dark:text-green-400" role="status">
            {giftSuccess.alreadyClaimedByYou
              ? t('giftClaim.alreadyYours', { points: giftSuccess.points })
              : t('giftClaim.success', { points: giftSuccess.points })}
            {giftSuccess.expiresAt
              ? ` ${t('giftClaim.expires', {
                  date: new Date(giftSuccess.expiresAt).toLocaleDateString(locale),
                })}`
              : ''}
          </p>
        )}
        {couponSuccess && (
          <p className="text-sm text-green-700 dark:text-green-400" role="status">
            {couponSuccess.discountType === 'fixed'
              ? t('giftClaim.couponSuccessFixed', {
                  amount: money(couponSuccess.discountValue),
                  code: couponSuccess.code,
                })
              : t('giftClaim.couponSuccessPercent', {
                  percent: couponSuccess.discountValue,
                  code: couponSuccess.code,
                })}
          </p>
        )}

        {authChecked && !isLoggedIn ? (
          <p className="text-sm text-muted">
            {t('giftClaim.loginRequired')}{' '}
            <Link
              href={`/profil?next=${encodeURIComponent(nextPath)}`}
              className="text-accent font-medium hover:underline"
            >
              {t('profile.loginCta')}
            </Link>
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || (!token.trim() && hideTokenInput)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('giftClaim.submitting') : t('giftClaim.submit')}
        </button>
      </form>
    </section>
  )
}
