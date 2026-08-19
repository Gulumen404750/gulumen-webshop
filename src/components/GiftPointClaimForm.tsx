'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useDisplayMoney } from '@/hooks/useDisplayMoney'
import { POINT_WALLET_SWR_KEY } from '@/lib/point-wallet-client'
import { mutate } from 'swr'
import { writeTypedCoupon, type StoredTypedCoupon } from '@/lib/typed-coupon-storage'
import { localeNoticeText, type LocaleNotice } from '@/lib/locale-notice'

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
  checkoutCode?: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderHuf: number | null
}

export type CodeRedeemSuccess = GiftClaimSuccess | CouponClaimSuccess

const REDEEM_ERROR_KEYS: Record<string, string> = {
  gift_code_invalid: 'giftClaim.previewNotFound',
  gift_code_used: 'giftClaim.previewUsed',
  gift_code_inactive: 'giftClaim.previewInactive',
  gift_code_expired: 'giftClaim.previewExpired',
  gift_code_not_yet_valid: 'giftClaim.previewNotYet',
  code_invalid: 'giftClaim.previewNotFound',
  code_required: 'giftClaim.errorRequired',
  login_required: 'giftClaim.loginRequired',
  db_unavailable: 'giftClaim.errorGeneric',
  gift_code_failed: 'giftClaim.errorGeneric',
  coupon_inactive: 'giftClaim.errorCouponInactive',
  coupon_expired: 'giftClaim.errorCouponExpired',
  coupon_used: 'giftClaim.errorCouponUsed',
  coupon_exhausted: 'giftClaim.errorCouponUsed',
  coupon_already_claimed: 'giftClaim.errorCouponAlreadyClaimed',
  coupon_wrong_user: 'giftClaim.errorCouponWrongUser',
  coupon_not_owned: 'giftClaim.errorCouponWrongUser',
  coupon_login_required: 'giftClaim.loginRequired',
}

type Props = {
  /** Előre kitöltött token (QR /claim oldal). */
  initialToken?: string
  /** Elrejti a token mezőt, ha a token az URL-ből jön. */
  hideTokenInput?: boolean
  className?: string
  onSuccess?: (result: CodeRedeemSuccess) => void
}

/** Kérdőjel: hover tooltip, kattintásra olvasható modal a szabályzattal. */
function GiftClaimHelpHint() {
  const { t } = useLocale()
  const { copy } = useDisplayMoney()
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const titleId = useId()
  const showTooltip = hover && !open
  const hint = t('giftClaim.hint', copy)

  useEffect(() => {
    if (!open && !showTooltip) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      setHover(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      if (open) return
      if (wrapRef.current?.contains(e.target as Node)) return
      setHover(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, showTooltip])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <div
      ref={wrapRef}
      className="relative shrink-0"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHover(true)
      }}
      onPointerLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--border)]/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={t('giftClaim.helpAria')}
        aria-expanded={open || showTooltip}
        aria-controls={panelId}
        onClick={() => {
          setHover(false)
          setOpen((current) => !current)
        }}
      >
        <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      {showTooltip ? (
        <div
          id={panelId}
          role="tooltip"
          className="absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-2.5rem))] rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 text-sm leading-snug text-muted shadow-lg"
        >
          {hint}
        </div>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 id={titleId} className="font-heading text-base font-semibold text-foreground">
                {t('giftClaim.title')}
              </h3>
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-[var(--border)]/60 hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label={t('buttons.close')}
              >
                <span aria-hidden className="text-lg leading-none">×</span>
              </button>
            </div>
            <p className="text-sm leading-relaxed text-muted">{hint}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function GiftPointClaimForm({
  initialToken = '',
  hideTokenInput = false,
  className = '',
  onSuccess,
}: Props) {
  const { t, locale } = useLocale()
  const { money } = useDisplayMoney()
  const { isLoggedIn, authChecked } = useAuth()
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<LocaleNotice | null>(null)
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
      setError({ key: 'giftClaim.errorRequired' })
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
        setError({ key: 'giftClaim.loginRequired' })
        return
      }
      if (!res.ok) {
        const code = typeof data.code === 'string' ? data.code : ''
        setError({
          key: REDEEM_ERROR_KEYS[code] ?? 'giftClaim.errorGeneric',
        })
        return
      }
      if (data.kind === 'coupon') {
        const result: CouponClaimSuccess = {
          kind: 'coupon',
          code: String(data.code || trimmed).toUpperCase(),
          checkoutCode:
            typeof data.checkoutCode === 'string' ? data.checkoutCode.toUpperCase() : undefined,
          discountType: data.discountType === 'fixed' ? 'fixed' : 'percent',
          discountValue: Number(data.discountValue) || 0,
          minOrderHuf: typeof data.minOrderHuf === 'number' ? data.minOrderHuf : null,
        }
        const stored: StoredTypedCoupon = {
          code: result.checkoutCode || result.code,
          discountType: result.discountType,
          discountValue: result.discountValue,
          minOrderHuf: result.minOrderHuf,
        }
        writeTypedCoupon(stored)
        setCouponSuccess(result)
        setToken('')
        await mutate(POINT_WALLET_SWR_KEY)
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
      setError({ key: 'giftClaim.errorGeneric' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {t('giftClaim.title')}
        </h2>
        <GiftClaimHelpHint />
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {!hideTokenInput && (
          <label className="block">
            <span className="text-sm font-medium text-foreground">{t('giftClaim.codeLabel')}</span>
            <input
              type="text"
              name="redeem-code"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`redeem-code-input mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground ${
                token ? 'font-mono' : 'font-sans'
              }`}
              placeholder={t('giftClaim.codePlaceholder')}
            />
          </label>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {localeNoticeText(t, error)}
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
