'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { POINT_WALLET_SWR_KEY } from '@/lib/point-wallet-client'
import { mutate } from 'swr'

type ClaimSuccess = {
  points: number
  expiresAt: string
  balanceAfter: number | null
  alreadyClaimedByYou?: boolean
}

type Props = {
  /** Előre kitöltött token (QR /claim oldal). */
  initialToken?: string
  /** Elrejti a token mezőt, ha a token az URL-ből jön. */
  hideTokenInput?: boolean
  className?: string
  onSuccess?: (result: ClaimSuccess) => void
}

export function GiftPointClaimForm({
  initialToken = '',
  hideTokenInput = false,
  className = '',
  onSuccess,
}: Props) {
  const { t } = useLocale()
  const { isLoggedIn, authChecked } = useAuth()
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<ClaimSuccess | null>(null)

  const nextPath =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/claim'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const trimmed = token.trim()
    if (!trimmed) {
      setError(t('giftClaim.errorRequired'))
      return
    }
    if (!isLoggedIn) {
      setError(t('giftClaim.loginRequired'))
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/gift-points/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmed }),
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
      const result: ClaimSuccess = {
        points: Number(data.points) || 0,
        expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : '',
        balanceAfter: typeof data.balanceAfter === 'number' ? data.balanceAfter : null,
        alreadyClaimedByYou: data.alreadyClaimedByYou === true,
      }
      setSuccess(result)
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
      <p className="text-sm text-muted mt-1">{t('giftClaim.hint')}</p>

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
        {success && (
          <p className="text-sm text-green-700 dark:text-green-400" role="status">
            {success.alreadyClaimedByYou
              ? t('giftClaim.alreadyYours', { points: success.points })
              : t('giftClaim.success', { points: success.points })}
            {success.expiresAt
              ? ` ${t('giftClaim.expires', {
                  date: new Date(success.expiresAt).toLocaleDateString(),
                })}`
              : ''}
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
        ) : (
          <button
            type="submit"
            disabled={busy || (!token.trim() && hideTokenInput)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t('giftClaim.submitting') : t('giftClaim.submit')}
          </button>
        )}
      </form>
    </section>
  )
}
