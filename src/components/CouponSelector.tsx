'use client'

import {
  MAX_COMBINED_COUPON_PERCENT,
  canToggleCoupon,
  type SelectableCoupon,
  type SelectableCouponId,
} from '@/lib/coupon-selection'

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
}

export function CouponSelector({
  coupons,
  selectedIds,
  onChange,
  title = 'Elérhető kuponok',
  hint = 'Válaszd ki, melyik kedvezmény(eke)t szeretnéd érvényesíteni. Összesen legfeljebb 20%.',
  emptyText = 'Jelenleg nincs felhasználható kuponod.',
  capReachedText = 'A kiválasztott kuponok összege nem haladhatja meg a 20%-ot.',
  selectedPercentDisplay = 0,
  capped = false,
}: Props) {
  const selected = new Set(selectedIds)

  const toggle = (id: SelectableCouponId) => {
    const turningOn = !selected.has(id)
    if (turningOn && !canToggleCoupon(coupons, selected, id, true)) {
      return
    }
    const next = new Set(selected)
    if (turningOn) next.add(id)
    else next.delete(id)
    onChange(Array.from(next))
  }

  if (coupons.length === 0) {
    return (
      <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
        <h2 className="font-heading text-lg font-semibold text-foreground mb-1">{title}</h2>
        <p className="text-sm text-muted">{emptyText}</p>
      </section>
    )
  }

  return (
    <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted mt-1">{hint}</p>
      </div>

      <ul className="space-y-2">
        {coupons.map((coupon) => {
          const checked = selected.has(coupon.id)
          const wouldExceed =
            !checked && !canToggleCoupon(coupons, selected, coupon.id, true)
          return (
            <li key={coupon.id}>
              <label
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-accent bg-accent/5'
                    : wouldExceed
                      ? 'border-[var(--border)] opacity-50 cursor-not-allowed'
                      : 'border-[var(--border)] hover:border-accent/40'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
                  checked={checked}
                  disabled={wouldExceed}
                  onChange={() => toggle(coupon.id)}
                />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground">{coupon.label}</span>
                    <span className="text-sm font-semibold text-discount tabular-nums">
                      −{Math.round(coupon.percent * 100)}%
                    </span>
                  </span>
                  {coupon.code && (
                    <span className="block text-xs text-muted mt-0.5 font-mono">{coupon.code}</span>
                  )}
                  {wouldExceed && (
                    <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {capReachedText}
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {selectedIds.length > 0 && (
        <p className="text-sm text-foreground">
          Kiválasztott kedvezmény:{' '}
          <strong className="text-discount">
            {Math.min(selectedPercentDisplay, Math.round(MAX_COMBINED_COUPON_PERCENT * 100))}%
          </strong>
          {capped && (
            <span className="text-muted"> (plafon: {Math.round(MAX_COMBINED_COUPON_PERCENT * 100)}%)</span>
          )}
        </p>
      )}
    </section>
  )
}
