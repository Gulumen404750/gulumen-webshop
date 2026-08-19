'use client'

import {
  MAX_COMBINED_COUPON_PERCENT,
  canToggleCoupon,
  isFixedSelectableCoupon,
  nextCouponSelection,
  type SelectableCoupon,
  type SelectableCouponId,
} from '@/lib/coupon-selection'
import { useLocale } from '@/context/LocaleContext'

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
}: Props) {
  const { t } = useLocale()
  const resolvedTitle = title ?? t('payment.couponSelectorTitle')
  const defaultHint =
    t('payment.couponSelectorHint')
  const resolvedHint = hint ?? defaultHint
  const resolvedEmpty = emptyText ?? t('payment.couponSelectorEmpty')
  const resolvedCap = capReachedText ?? t('payment.couponCapReached')
  const selected = new Set(selectedIds)

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

  if (coupons.length === 0) {
    return (
      <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
        <h2 className="font-heading text-lg font-semibold text-foreground mb-1">{resolvedTitle}</h2>
        <p className="text-sm text-muted">{resolvedEmpty}</p>
      </section>
    )
  }

  return (
    <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">{resolvedTitle}</h2>
        <p className="text-sm text-muted mt-1">{resolvedHint}</p>
      </div>

      <ul className="space-y-2">
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
                    {!isFixed && (
                      <span className="text-sm font-semibold text-discount tabular-nums">
                        −{Math.round(coupon.percent * 100)}%
                      </span>
                    )}
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
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {selectedIds.length > 0 && selectedPercentDisplay > 0 && (
        <p className="text-sm text-foreground">
          {t('payment.couponSelectedLabel')}{' '}
          <strong className="text-discount">
            {Math.min(selectedPercentDisplay, Math.round(MAX_COMBINED_COUPON_PERCENT * 100))}%
          </strong>
          {capped && (
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
