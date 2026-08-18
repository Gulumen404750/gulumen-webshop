'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

type ShippingForm = {
  customerName: string
  customerPhone: string
  shippingPostalCode: string
  shippingCity: string
  shippingStreet: string
  shippingHouseNumber: string
  deliveryNotes: string
}

type Props = {
  orderId: string
  initial: ShippingForm
  /** inline: gombbal nyílik; page: azonnal szerkesztő űrlap */
  mode?: 'inline' | 'page'
  /** E-mail CTA token – ha van, tokenes API-t használ (bejelentkezés nélkül). */
  editToken?: string | null
  labels: {
    title: string
    hint: string
    name: string
    phone: string
    postalCode: string
    city: string
    street: string
    houseNumber: string
    notes: string
    save: string
    saving: string
    cancel: string
    success: string
    open: string
    saveFailed: string
    networkError: string
  }
  onSaved: (next: {
    customerName: string | null
    customerPhone: string | null
    shipping: {
      postalCode: string
      city: string
      street: string
      houseNumber: string
    }
    deliveryNotes: string | null
    shippingAddressChangedAt: string | null
    canEditShipping: boolean
  }) => void
}

export function CustomerOrderShippingEdit({
  orderId,
  initial,
  labels,
  onSaved,
  mode = 'inline',
  editToken = null,
}: Props) {
  const [open, setOpen] = useState(mode === 'page')
  const [form, setForm] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const set =
    (key: keyof ShippingForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
      setOk(false)
      setError(null)
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    setOk(false)
    try {
      const endpoint = editToken
        ? `/api/orders/${encodeURIComponent(orderId)}/shipping-edit`
        : `/api/me/orders/${encodeURIComponent(orderId)}/shipping`
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editToken ? { ...form, t: editToken } : form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(labels.saveFailed)
        return
      }
      setOk(true)
      onSaved({
        customerName: data.order?.customerName ?? form.customerName,
        customerPhone: data.order?.customerPhone ?? form.customerPhone,
        shipping: data.order?.shipping ?? {
          postalCode: form.shippingPostalCode,
          city: form.shippingCity,
          street: form.shippingStreet,
          houseNumber: form.shippingHouseNumber,
        },
        deliveryNotes: data.order?.deliveryNotes ?? form.deliveryNotes,
        shippingAddressChangedAt: data.order?.shippingAddressChangedAt ?? new Date().toISOString(),
        canEditShipping: data.order?.canEditShipping ?? true,
      })
      if (mode === 'inline') setOpen(false)
    } catch {
      setError(labels.networkError)
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={() => {
            setForm(initial)
            setOpen(true)
            setOk(false)
            setError(null)
          }}
          className="text-sm font-medium text-accent hover:underline"
        >
          {labels.open}
        </button>
        {ok && <p className="mt-2 text-sm text-emerald-700">{labels.success}</p>}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        mode === 'page'
          ? 'space-y-4'
          : 'mt-3 space-y-3 border-t border-[var(--border)] pt-3'
      }
    >
      <div>
        <h3 className={mode === 'page' ? 'text-lg font-semibold text-foreground' : 'text-sm font-semibold text-foreground'}>
          {labels.title}
        </h3>
        <p className="mt-1 text-xs text-muted sm:text-sm">{labels.hint}</p>
      </div>
      {ok && mode === 'page' && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200" role="status">
          {labels.success}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs sm:text-sm">
          {labels.name}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={form.customerName}
            onChange={set('customerName')}
            autoComplete="name"
          />
        </label>
        <label className="text-xs sm:text-sm">
          {labels.phone}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={form.customerPhone}
            onChange={set('customerPhone')}
            autoComplete="tel"
          />
        </label>
        <label className="text-xs sm:text-sm">
          {labels.postalCode}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={form.shippingPostalCode}
            onChange={set('shippingPostalCode')}
            required
            autoComplete="postal-code"
          />
        </label>
        <label className="text-xs sm:text-sm">
          {labels.city}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={form.shippingCity}
            onChange={set('shippingCity')}
            required
            autoComplete="address-level2"
          />
        </label>
        <label className="text-xs sm:text-sm">
          {labels.street}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={form.shippingStreet}
            onChange={set('shippingStreet')}
            required
            autoComplete="address-line1"
          />
        </label>
        <label className="text-xs sm:text-sm">
          {labels.houseNumber}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={form.shippingHouseNumber}
            onChange={set('shippingHouseNumber')}
            required
          />
        </label>
      </div>
      <label className="block text-xs sm:text-sm">
        {labels.notes}
        <textarea
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
          rows={2}
          value={form.deliveryNotes}
          onChange={set('deliveryNotes')}
        />
      </label>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? labels.saving : labels.save}
        </button>
        {mode === 'inline' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-foreground hover:bg-[var(--border)]/30"
          >
            {labels.cancel}
          </button>
        )}
      </div>
    </form>
  )
}
