'use client'

import { useCallback, useEffect, useState } from 'react'

type StatusResponse = {
  passwordSet?: boolean
  passwordSetAt?: string | null
  requiresTwoFactor?: boolean
  error?: string
}

export default function PasswordSettings() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [passwordSet, setPasswordSet] = useState(false)
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [totpCode, setTotpCode] = useState('')

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/password', { credentials: 'include' })
      const data: StatusResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          data.error || (res.status === 401 ? 'Nincs jogosultság' : 'Státusz lekérdezése sikertelen')
        )
      }
      setPasswordSet(Boolean(data.passwordSet))
      setRequiresTwoFactor(Boolean(data.requiresTwoFactor))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (newPassword !== newPassword2) {
      setError('A két új jelszó nem egyezik.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword,
          currentPassword: passwordSet ? currentPassword : undefined,
          totpCode,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'A jelszó mentése sikertelen.')
      }
      setPasswordSet(true)
      setCurrentPassword('')
      setNewPassword('')
      setNewPassword2('')
      setTotpCode('')
      setMessage(
        'A jelszó elmentve. Elfelejtéskor az e-mailes visszaállítás használható, Railway env-cserére nincs szükség.'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mentés sikertelen')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-background p-4">
        <h2 className="text-lg font-semibold mb-2">Admin jelszó</h2>
        <p className="text-sm text-muted">Betöltés…</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Admin jelszó</h2>
        <p className="text-sm text-muted mt-1">
          A jelszó az adatbázisban van, kétlépcsősen visszaállítható (e-mail token + TOTP). Az{' '}
          <code>ADMIN_API_KEY</code> env vészhelyzeti belépés marad; a nyers kulcs soha nem megy
          e-mailben.
        </p>
      </div>

      <p
        className={`text-sm font-medium ${
          passwordSet ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
        }`}
      >
        {passwordSet ? 'Jelszó be van állítva' : 'Még nincs jelszó – most az API kulccsal lépsz be'}
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-sm text-foreground">{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        {passwordSet && (
          <div>
            <label htmlFor="current-admin-password" className="block text-sm font-medium mb-1">
              Jelenlegi jelszó
            </label>
            <input
              id="current-admin-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
              autoComplete="current-password"
            />
          </div>
        )}
        <div>
          <label htmlFor="new-admin-password" className="block text-sm font-medium mb-1">
            Új jelszó (min. 12 karakter, betű + szám)
          </label>
          <input
            id="new-admin-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
            autoComplete="new-password"
            minLength={12}
          />
        </div>
        <div>
          <label htmlFor="new-admin-password2" className="block text-sm font-medium mb-1">
            Új jelszó mégegyszer
          </label>
          <input
            id="new-admin-password2"
            type="password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
            autoComplete="new-password"
            minLength={12}
          />
        </div>
        {requiresTwoFactor && (
          <div>
            <label htmlFor="password-totp" className="block text-sm font-medium mb-1">
              2FA kód
            </label>
            <input
              id="password-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-36 px-3 py-2 rounded-lg border border-[var(--border)] bg-background tracking-[0.3em] text-center"
              placeholder="000000"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Mentés…' : passwordSet ? 'Jelszó cseréje' : 'Jelszó beállítása'}
        </button>
      </form>
    </section>
  )
}
