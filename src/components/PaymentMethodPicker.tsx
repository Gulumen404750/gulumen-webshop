'use client'

import { CreditCard, Smartphone, Wallet } from 'lucide-react'
import type { CheckoutPaymentMethod } from '@/lib/checkout-payment-methods'
import { CHECKOUT_PAYMENT_METHODS } from '@/lib/checkout-payment-methods'

type MethodCopy = {
  label: string
  hint: string
}

const METHOD_ICONS: Record<CheckoutPaymentMethod, typeof CreditCard> = {
  card: CreditCard,
  paypal: Wallet,
  apple_pay: Smartphone,
  google_pay: Smartphone,
  klarna: Wallet,
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
          const Icon = METHOD_ICONS[method]
          const selected = value === method
          const isExpress = method === 'apple_pay' || method === 'google_pay'
          const unavailable = unavailableMethods?.includes(method) ?? false
          const locked = Boolean(disabled || unavailable)
          return (
            <label
              key={method}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
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
                className="mt-1 w-4 h-4 text-accent focus:ring-accent"
              />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
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
