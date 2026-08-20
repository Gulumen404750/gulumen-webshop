'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import {
  MAX_COMBINED_COUPON_PERCENT,
  canToggleCoupon,
  isFixedSelectableCoupon,
  nextCouponSelection,
  type SelectableCoupon,
  type SelectableCouponId,
} from '@/lib/coupon-selection'
import { useLocale } from '@/context/LocaleContext'
import { useDisplayMoney } from '@/hooks/useDisplayMoney'

type Props = {
  coupons: SelectableCoupon[]
  selectedIds: SelectableCouponId[]
  onChange: (next: SelectableCouponId[]) => void
  title?: string
  hint?: string
  emptyText?: string
  capReachedText?: string
  /** Nyers összeg % (0–100) megjelenítéshez. */
  selectedPercentDisplay?: number
  capped?: boolean
  disabled?: boolean
  exclusiveHint?: string
}

/** Kérdőjel: desktopon hover, mobilon kattintás – a szabályzat a buborékban van. */
function CouponSelectorHelpHint({ text, ariaLabel }: { text: string; ariaLabel: string }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const visible = hover || open

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      setHover(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      setOpen(false)
      setHover(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [visible])

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
        aria-label={ariaLabel}
        aria-expanded={visible}
        aria-controls={panelId}
        onClick={() => {
          setHover(false)
          setOpen((current) => !current)
        }}
      >
        <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      {visible ? (
        <div
          id={panelId}
          role="tooltip"
          className="absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-2.5rem))] rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 text-sm leading-snug text-muted shadow-lg"
        >
          {text}
        </div>
      ) : null}
    </div>
  )
}

export function CouponSelector({
  coupons,
  selectedIds,
  onChange,
  title,
  hint,
  emptyText,
  capReachedText,
  selectedPercentDisplay = 0,
  capped = false,
  disabled = false,
  exclusiveHint,
}: Props) {
  const { t } = useLocale()
  const { money } = useDisplayMoney()
  const resolvedTitle = title ?? t('payment.couponSelectorTitle')
  const resolvedHint = hint ?? t('payment.couponSelectorHint')
  const resolvedEmpty = emptyText ?? t('payment.couponSelectorEmpty')
  const resolvedCap = capReachedText ?? t('payment.couponCapReached')
  const helpAria = t('payment.couponSelectorHelpAria')
  const selected = new Set(selectedIds)
  const selectedFixedHuf = coupons
    .filter((coupon) => selected.has(coupon.id) && isFixedSelectableCoupon(coupon))
    .reduce((sum, coupon) => sum + (coupon.fixedHuf ?? 0), 0)
  const percentDisplay =
    selectedPercentDisplay > 0
      ? Math.min(selectedPercentDisplay, Math.round(MAX_COMBINED_COUPON_PERCENT * 100))
      : 0
  const showSelectedSummary = selectedIds.length > 0 && (percentDisplay > 0 || selectedFixedHuf > 0)

  const toggle = (id: SelectableCouponId) => {
    if (disabled) return
    const turningOn = !selected.has(id)
    if (!turningOn) {
      onChange(nextCouponSelection(coupons, selected, id, false))
      return
    }
    if (!canToggleCoupon(coupons, selected, id, true)) return
    onChange(nextCouponSelection(coupons, selected, id, true))
  }

  const header = (
    <div className="flex items-start justify-between gap-2">
      <h2 className="font-heading text-lg font-semibold text-foreground">{resolvedTitle}</h2>
      <CouponSelectorHelpHint text={resolvedHint} ariaLabel={helpAria} />
    </div>
  )

  if (coupons.length === 0) {
    return (
      <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
        {header}
        <p className="text-sm text-muted mt-2">{resolvedEmpty}</p>
      </section>
    )
  }

  return (
    <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-3">
      {header}

      <ul className={`space-y-2 ${disabled ? 'opacity-60' : ''}`}>
        {coupons.map((coupon) => {
          const checked = selected.has(coupon.id)
          const cannotSelect =
            !checked && !canToggleCoupon(coupons, selected, coupon.id, true)
          const isFixed = isFixedSelectableCoupon(coupon)
          return (
            <li key={coupon.id}>
              <label
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-accent bg-accent/5'
                    : cannotSelect
                      ? 'border-[var(--border)] opacity-50 cursor-not-allowed'
                      : 'border-[var(--border)] hover:border-accent/40'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
                  checked={checked}
                  disabled={disabled || cannotSelect}
                  onChange={() => toggle(coupon.id)}
                />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground">{coupon.label}</span>
                    {isFixed && (coupon.fixedHuf ?? 0) > 0 ? (
                      <span className="text-sm font-semibold text-discount tabular-nums">
                        −{money(coupon.fixedHuf ?? 0)}
                      </span>
                    ) : coupon.percent > 0 ? (
                      <span className="text-sm font-semibold text-discount tabular-nums">
                        −{Math.round(coupon.percent * 100)}%
                      </span>
                    ) : null}
                  </span>
                  {coupon.code && (
                    <span className="block text-xs text-muted mt-0.5 font-mono">{coupon.code}</span>
                  )}
                  {coupon.hint && (
                    <span className="block text-xs text-muted mt-0.5">{coupon.hint}</span>
                  )}
                  {cannotSelect && (
                    <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {resolvedCap}
                    </span>
                  )}
                  {disabled && !checked && exclusiveHint ? (
                    <span className="block text-xs text-muted mt-1">{exclusiveHint}</span>
                  ) : null}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {showSelectedSummary && (
        <p className="text-sm text-foreground">
          {t('payment.couponSelectedLabel')}{' '}
          <strong className="text-discount">
            {percentDisplay > 0 ? `${percentDisplay}%` : null}
            {percentDisplay > 0 && selectedFixedHuf > 0 ? ' + ' : null}
            {selectedFixedHuf > 0 ? money(selectedFixedHuf) : null}
          </strong>
          {capped && percentDisplay > 0 && (
            <span className="text-muted">
              {' '}
              {t('payment.couponCappedLabel', {
                percent: Math.round(MAX_COMBINED_COUPON_PERCENT * 100),
              })}
            </span>
          )}
        </p>
      )}
    </section>
  )
}
