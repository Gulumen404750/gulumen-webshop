'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ABANDONED_CART_OFFER_PERCENTS,
  type AbandonedCartOfferPercent,
  type AdminCartSnapshotRow,
} from '@/lib/cart-snapshot'

type Filter = 'abandoned' | 'all'

function formatHuf(n: number): string {
  return `${n.toLocaleString('hu-HU')} Ft`
}

function formatDt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CartLines({ lines }: { lines: AdminCartSnapshotRow['lines'] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted">Üres kosár</p>
  }
  return (
    <ul className="text-sm space-y-1">
      {lines.map((line) => {
        const opts: string[] = []
        if (line.options?.colorName) opts.push(line.options.colorName)
        const optSuffix = opts.length ? ` (${opts.join(', ')})` : ''
        return (
          <li key={`${line.productId}-${optSuffix}-${line.qty}`}>
            <span className="font-medium">{line.name}</span>
            {optSuffix && <span className="text-muted">{optSuffix}</span>}
            {' '}
            – {line.qty} db × {formatHuf(line.unitPriceHuf)}
            <span className="text-muted"> = {formatHuf(line.lineTotalHuf)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function AbandonedCartsSection() {
  const [carts, setCarts] = useState<AdminCartSnapshotRow[]>([])
  const [abandonedDays, setAbandonedDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('abandoned')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [offerPercent, setOfferPercent] = useState<Record<string, AbandonedCartOfferPercent>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/abandoned-carts?filter=${filter}`, { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Betöltési hiba')
        return data as { carts: AdminCartSnapshotRow[]; abandonedDays: number }
      })
      .then((data) => {
        setCarts(data.carts ?? [])
        setAbandonedDays(data.abandonedDays ?? 7)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Betöltési hiba'))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return carts
    return carts.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.name?.toLowerCase().includes(q) ?? false)
    )
  }, [carts, search])

  const toggleExpand = (userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const percentFor = (userId: string): AbandonedCartOfferPercent =>
    offerPercent[userId] ?? ABANDONED_CART_OFFER_PERCENTS[0]

  const sendOffer = async (userId: string) => {
    const percent = percentFor(userId)
    const key = `offer-${userId}`
    setSending(key)
    setToast(null)
    try {
      const res = await fetch(`/api/admin/abandoned-carts/${userId}/offer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Küldési hiba')
      setToast({
        type: 'ok',
        text: `Kedvezmény e-mail elküldve (${percent}%): ${data.couponCode}${
          data.emailSent ? '' : ' – figyelmeztetés: e-mail szolgáltatás nem erősítette meg a küldést'
        }`,
      })
      load()
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Küldési hiba' })
    } finally {
      setSending(null)
    }
  }

  const sendReminder = async (userId: string) => {
    const key = `remind-${userId}`
    setSending(key)
    setToast(null)
    try {
      const res = await fetch(`/api/admin/abandoned-carts/${userId}/remind`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Küldési hiba')
      setToast({
        type: 'ok',
        text: `Alap emlékeztető e-mail elküldve: ${data.to ?? 'a vásárló címére'}`,
      })
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Küldési hiba' })
    } finally {
      setSending(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setFilter('abandoned')}
            className={`px-3 py-1.5 text-sm font-medium ${
              filter === 'abandoned' ? 'bg-accent/20 text-accent' : 'hover:bg-[var(--border)]/30'
            }`}
          >
            Elhagyott ({abandonedDays}+ nap)
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium border-l border-[var(--border)] ${
              filter === 'all' ? 'bg-accent/20 text-accent' : 'hover:bg-[var(--border)]/30'
            }`}
          >
            Minden kosár
          </button>
        </div>
        <input
          type="search"
          placeholder="Keresés e-mail / név…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-1.5 text-sm min-w-[200px]"
        />
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]/30"
        >
          Frissítés
        </button>
      </div>

      {toast && (
        <p
          className={`text-sm rounded-lg border px-3 py-2 ${
            toast.type === 'ok'
              ? 'border-green-600/30 bg-green-600/10 text-green-800 dark:text-green-300'
              : 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-300'
          }`}
        >
          {toast.text}
        </p>
      )}

      {loading && <p className="text-sm text-muted">Betöltés…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-muted">
          {filter === 'abandoned'
            ? `Nincs ${abandonedDays} napnál régebbi, meg nem vásárolt kosár.`
            : 'Nincs aktív kosár pillanatkép.'}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((cart) => {
          const isOpen = expanded.has(cart.userId)
          const canAct = !cart.purchasedSinceUpdate && cart.itemCount > 0 && Boolean(cart.email)
          const busyOffer = sending === `offer-${cart.userId}`
          const busyRemind = sending === `remind-${cart.userId}`
          const busy = sending != null

          return (
            <article
              key={cart.userId}
              className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{cart.email}</p>
                  {cart.name && <p className="text-sm text-muted">{cart.name}</p>}
                  <p className="text-sm mt-1">
                    <span className="font-medium">{cart.itemCount} db</span>
                    {' · '}
                    <span>{formatHuf(cart.subtotalHuf)}</span>
                    {' · '}
                    <span className="text-muted">Utoljára: {formatDt(cart.lastUpdatedAt)}</span>
                    {' · '}
                    <span
                      className={
                        cart.daysSinceUpdate >= abandonedDays
                          ? 'text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-muted'
                      }
                    >
                      {cart.daysSinceUpdate} napja
                    </span>
                  </p>
                  {cart.purchasedSinceUpdate && (
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      Vásárlás történt a kosár frissítése óta
                    </p>
                  )}
                  {cart.lastOfferAt && (
                    <p className="text-xs text-muted mt-1">
                      Utolsó ajánlat: {cart.lastOfferPercent}% – {formatDt(cart.lastOfferAt)}
                      {cart.lastOfferCouponCode && ` (${cart.lastOfferCouponCode})`}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {cart.isAbandoned && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-600/15 text-amber-700 dark:text-amber-400">
                      Elhagyott
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(cart.userId)}
                    className="text-sm text-accent hover:underline"
                  >
                    {isOpen ? 'Összecsuk' : 'Megnyitás'}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-[var(--border)] pt-3 space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted mb-2">
                      Kosár tartalma
                    </p>
                    <CartLines lines={cart.lines} />
                  </div>

                  {canAct ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3">
                      <p className="text-sm font-medium">Műveletek – {cart.email}</p>

                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-1 text-sm min-w-[140px]">
                          <span className="text-muted">Kedvezmény mértéke</span>
                          <select
                            value={percentFor(cart.userId)}
                            onChange={(e) =>
                              setOfferPercent((prev) => ({
                                ...prev,
                                [cart.userId]: Number(e.target.value) as AbandonedCartOfferPercent,
                              }))
                            }
                            disabled={busy}
                            className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm"
                          >
                            {ABANDONED_CART_OFFER_PERCENTS.map((pct) => (
                              <option key={pct} value={pct}>
                                {pct}%
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => sendOffer(cart.userId)}
                          className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
                        >
                          {busyOffer ? 'Küldés…' : 'Kedvezmény e-mail küldése'}
                        </button>
                      </div>
                      <p className="text-xs text-muted">
                        Személyes kuponkódot generál (egyszer használható, 14 nap), és elküldi a
                        fenti e-mail címre.
                      </p>

                      <div className="border-t border-[var(--border)] pt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => sendReminder(cart.userId)}
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--border)]/30 disabled:opacity-50"
                        >
                          {busyRemind ? 'Küldés…' : 'Alap emlékeztető e-mail'}
                        </button>
                        <span className="text-xs text-muted">
                          Kupon nélküli rendszerüzenet: „termékek várnak a kosaradban”.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      {cart.purchasedSinceUpdate
                        ? 'Ehhez a kosárhoz nem küldhető ajánlat – már történt vásárlás.'
                        : 'Nincs e-mail cím vagy üres a kosár.'}
                    </p>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
