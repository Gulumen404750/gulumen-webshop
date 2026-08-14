'use client'

import { useCallback, useEffect, useState } from 'react'

type Status = {
  mustChangeKey?: boolean
  keyConfirmedAt?: string | null
  maxAgeDays?: number | null
  daysOld?: number | null
  fingerprintPrefix?: string | null
  error?: string
}

export default function KeyPolicySettings() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/key-policy', { credentials: 'include' })
      const data: Status = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Státusz lekérdezése sikertelen')
      }
      setStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function forceRotate() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/key-policy', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mustChangeKey: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'A kényszerítés sikertelen.')
      }
      setStatus((s) => ({ ...s, mustChangeKey: true }))
      setMessage(
        'A következő belépéshez új ADMIN_API_KEY kell. Cseréld a kulcsot Railway-en; a régi JWT sütik a csere után azonnal érvénytelenek (ak + sv claim).'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-background p-4">
        <h2 className="text-lg font-semibold mb-2">API kulcs csere kényszer</h2>
        <p className="text-sm text-muted">Betöltés…</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">API kulcs csere kényszer</h2>
        <p className="text-sm text-muted mt-1">
          A session JWT-t a <code>JWT_SECRET</code> írja alá. Az <code>ADMIN_API_KEY</code> csere a JWT{' '}
          <code>ak</code> / <code>sv</code> claimje miatt ugyanúgy kiléptet. Periodikus csere:{' '}
          <code>ADMIN_KEY_MAX_AGE_DAYS</code> (alap 90, 0 = kikapcsolva). A flag emlékeztető — a gyári
          kulcs + 2FA owner belépés <strong>nem</strong> záródik ki; sikeres belépés törli a
          mustChangeKey-t.
        </p>
      </div>

      <ul className="text-sm space-y-1">
        <li>
          {status.mustChangeKey ? (
            <span className="text-amber-700 dark:text-amber-400 font-medium">mustChangeKey aktív</span>
          ) : (
            <span className="text-green-700 dark:text-green-400 font-medium">mustChangeKey ki van kapcsolva</span>
          )}
        </li>
        <li className="text-muted">
          Kulcs kora: {status.daysOld == null ? 'még nincs rögzítve' : `${status.daysOld} nap`}
          {status.maxAgeDays != null ? ` (max ${status.maxAgeDays} nap)` : ' (nincs max életkor)'}
        </li>
        {status.fingerprintPrefix && (
          <li className="font-mono text-xs text-muted">fingerprint {status.fingerprintPrefix}…</li>
        )}
      </ul>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-sm text-foreground">{message}</p>}

      <button
        type="button"
        onClick={() => void forceRotate()}
        disabled={busy || status.mustChangeKey}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--border)]/30 disabled:opacity-60"
      >
        {busy ? 'Mentés…' : 'Következő belépéshez új kulcs kell'}
      </button>
    </section>
  )
}
