'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  orderId: string
  initial: {
    customerName: string
    customerPhone: string
    customerEmail: string
    shippingPostalCode: string
    shippingCity: string
    shippingStreet: string
    shippingHouseNumber: string
    billingSameAsShipping: boolean
    billingPostalCode: string
    billingCity: string
    billingStreet: string
    billingHouseNumber: string
    deliveryNotes: string
  }
}

export function AdminOrderCustomerEditForm({ orderId, initial }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value =
        e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
      setForm((prev) => ({ ...prev, [key]: value }))
      setOk(false)
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    setOk(false)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Mentés sikertelen')
        return
      }
      setOk(true)
      router.refresh()
    } catch {
      setError('Hálózati hiba')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
      <h3 className="font-semibold text-foreground">Cím / vevőadat módosítás (csomagolás előtt)</h3>
      <p className="text-sm text-muted">
        Ha a vásárló e-mailben kér címváltoztatást, itt írd át, mielőtt feladnád a csomagot.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Név
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            value={form.customerName}
            onChange={set('customerName')}
          />
        </label>
        <label className="text-sm">
          Telefon
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            value={form.customerPhone}
            onChange={set('customerPhone')}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          E-mail
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            value={form.customerEmail}
            onChange={set('customerEmail')}
          />
        </label>
        <label className="text-sm">
          Irányítószám
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            value={form.shippingPostalCode}
            onChange={set('shippingPostalCode')}
          />
        </label>
        <label className="text-sm">
          Város
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            value={form.shippingCity}
            onChange={set('shippingCity')}
          />
        </label>
        <label className="text-sm">
          Utca
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            value={form.shippingStreet}
            onChange={set('shippingStreet')}
          />
        </label>
        <label className="text-sm">
          Házszám
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
            value={form.shippingHouseNumber}
            onChange={set('shippingHouseNumber')}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.billingSameAsShipping}
          onChange={set('billingSameAsShipping')}
        />
        Számlázási cím = szállítási cím
      </label>
      {!form.billingSameAsShipping && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Számlázási irányítószám
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
              value={form.billingPostalCode}
              onChange={set('billingPostalCode')}
            />
          </label>
          <label className="text-sm">
            Számlázási város
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
              value={form.billingCity}
              onChange={set('billingCity')}
            />
          </label>
          <label className="text-sm">
            Számlázási utca
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
              value={form.billingStreet}
              onChange={set('billingStreet')}
            />
          </label>
          <label className="text-sm">
            Számlázási házszám
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
              value={form.billingHouseNumber}
              onChange={set('billingHouseNumber')}
            />
          </label>
        </div>
      )}
      <label className="block text-sm">
        Megjegyzés a futárnak
        <textarea
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2"
          rows={3}
          value={form.deliveryNotes}
          onChange={set('deliveryNotes')}
        />
      </label>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {ok && (
        <p className="text-sm text-emerald-700" role="status">
          Mentve. A címke a friss adatokat használja.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Mentés…' : 'Adatok mentése'}
      </button>
    </form>
  )
}
