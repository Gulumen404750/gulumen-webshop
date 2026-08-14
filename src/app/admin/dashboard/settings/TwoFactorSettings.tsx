'use client'

import { useCallback, useEffect, useState } from 'react'

type StatusResponse = {
  isTwoFactorEnabled?: boolean
  hasSecret?: boolean
  error?: string
}

type SetupResponse = {
  ok?: boolean
  qrDataUrl?: string
  otpauthUrl?: string
  secret?: string
  error?: string
}

export default function TwoFactorSettings() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [hasSecret, setHasSecret] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/2fa', { credentials: 'include' })
      const data: StatusResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || (res.status === 401 ? 'Nincs jogosultság' : 'Státusz lekérdezése sikertelen'))
      }
      setEnabled(Boolean(data.isTwoFactorEnabled))
      setHasSecret(Boolean(data.hasSecret))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function startSetup() {
    setBusy(true)
    setError(null)
    setMessage(null)
    setCode('')
    try {
      const res = await fetch('/api/admin/2fa/setup', {
        method: 'POST',
        credentials: 'include',
      })
      const data: SetupResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'A QR-kód generálása sikertelen.')
      }
      setQrDataUrl(data.qrDataUrl || null)
      setSecret(data.secret || null)
      setEnabled(false)
      setHasSecret(true)
      setMessage('Olvasd be a QR-kódot, majd erősítsd meg a 6 jegyű kóddal. Addig a 2FA nem aktív.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beállítás sikertelen')
    } finally {
      setBusy(false)
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/2fa/verify-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Érvénytelen kód')
      }
      setEnabled(true)
      setQrDataUrl(null)
      setSecret(null)
      setCode('')
      setMessage('A kétlépcsős azonosítás aktív. A következő belépéskor Authenticator-kód kell.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Megerősítés sikertelen')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-background p-4">
        <h2 className="text-lg font-semibold mb-2">Kétlépcsős azonosítás (2FA)</h2>
        <p className="text-sm text-muted">Betöltés…</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Kétlépcsős azonosítás (2FA)</h2>
        <p className="text-sm text-muted mt-1">
          Google Authenticator (TOTP). A belépéshez API kulcs után 6 jegyű kód kell.
        </p>
      </div>

      <p className={`text-sm font-medium ${enabled ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
        {enabled ? '2FA aktív' : hasSecret && qrDataUrl ? 'Megerősítésre vár' : '2FA ki van kapcsolva'}
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-sm text-foreground">{message}</p>}

      {qrDataUrl && (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="Google Authenticator QR-kód"
            className="w-44 h-44 rounded-lg border border-[var(--border)] bg-white"
          />
          <div className="space-y-2 text-sm">
            <p className="text-muted">Ha nem tudod beolvasni, add meg kézzel ezt a titkot:</p>
            <code className="block break-all rounded bg-[var(--border)]/40 px-2 py-1 font-mono text-xs">
              {secret}
            </code>
          </div>
        </div>
      )}

      {qrDataUrl ? (
        <form onSubmit={confirmSetup} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="setup-totp" className="block text-sm font-medium mb-1">
              6 jegyű kód
            </label>
            <input
              id="setup-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-36 px-3 py-2 rounded-lg border border-[var(--border)] bg-background tracking-[0.3em] text-center"
              placeholder="000000"
            />
          </div>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Ellenőrzés…' : '2FA élesítése'}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => void startSetup()}
          disabled={busy}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--border)]/30 disabled:opacity-60"
        >
          {busy ? 'Generálás…' : enabled ? 'Újra párosítás (QR)' : 'Google Authenticator párosítása'}
        </button>
      )}
    </section>
  )
}
