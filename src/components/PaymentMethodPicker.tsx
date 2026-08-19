'use client'

import type { CheckoutPaymentMethod } from '@/lib/checkout-payment-methods'
import { CHECKOUT_PAYMENT_METHODS } from '@/lib/checkout-payment-methods'
import { PaymentMethodLogo } from '@/components/PaymentMethodLogo'

type MethodCopy = {
  label: string
  hint: string
}

export function PaymentMethodPicker({
  value,
  onChange,
  disabled,
  unavailableMethods,
  methods,
  title,
  expressBadge,
}: {
  value: CheckoutPaymentMethod
  onChange: (method: CheckoutPaymentMethod) => void
  disabled?: boolean
  unavailableMethods?: readonly CheckoutPaymentMethod[]
  methods: Record<CheckoutPaymentMethod, MethodCopy>
  title: string
  expressBadge: string
}) {
  return (
    <fieldset className="mb-4" disabled={disabled}>
      <legend className="text-sm font-semibold text-foreground mb-3">{title}</legend>
      <div className="grid gap-2" role="radiogroup" aria-label={title}>
        {CHECKOUT_PAYMENT_METHODS.map((method) => {
          const selected = value === method
          const isExpress = method === 'apple_pay' || method === 'google_pay'
          const unavailable = unavailableMethods?.includes(method) ?? false
          const locked = Boolean(disabled || unavailable)
          return (
            <label
              key={method}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                selected
                  ? 'border-accent bg-accent/5'
                  : 'border-[var(--border)] bg-background/60 hover:border-accent/40'
              } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name="checkout-payment-method"
                value={method}
                checked={selected}
                disabled={unavailable}
                onChange={() => {
                  if (!unavailable) onChange(method)
                }}
                className="mt-0 w-4 h-4 text-accent focus:ring-accent"
              />
              <PaymentMethodLogo method={method} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{methods[method].label}</span>
                  {isExpress && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {expressBadge}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted leading-snug">{methods[method].hint}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
