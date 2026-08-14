'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function AdminResetForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams])

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'A kérés sikertelen.')
        return
      }
      setMessage(data?.message || 'Ha a visszaállítás elérhető, elküldtük a linket az admin e-mail címre.')
    } catch {
      setError('Hiba történt.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password !== password2) {
      setError('A két jelszó nem egyezik.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, totpCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'A visszaállítás sikertelen.')
        return
      }
      router.push('/admin/login')
      router.refresh()
    } catch {
      setError('Hiba történt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--card-bg)] p-4">
      {token ? (
        <form onSubmit={handleConfirm} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Új admin jelszó</h1>
          <p className="text-sm text-muted">
            A link 15 percig érvényes. Ha a 2FA be van kapcsolva, a hitelesítő alkalmazás kódja is kell.
          </p>
          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium mb-1">
              Új jelszó
            </label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
              autoComplete="new-password"
              minLength={12}
            />
          </div>
          <div>
            <label htmlFor="reset-password2" className="block text-sm font-medium mb-1">
              Új jelszó mégegyszer
            </label>
            <input
              id="reset-password2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
              autoComplete="new-password"
              minLength={12}
            />
          </div>
          <div>
            <label htmlFor="reset-totp" className="block text-sm font-medium mb-1">
              2FA kód (ha be van kapcsolva)
            </label>
            <input
              id="reset-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background tracking-[0.4em] text-center"
              placeholder="000000"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Mentés…' : 'Jelszó mentése'}
          </button>
          <p className="text-center text-sm">
            <Link href="/admin/login" className="text-muted hover:text-foreground underline">
              Vissza a belépéshez
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleRequest} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Jelszó visszaállítása</h1>
          <p className="text-sm text-muted">
            A 15 perces linket az admin e-mail címre küldjük (<code>ADMIN_EMAIL</code>). A 2. lépés a
            hitelesítő kód, ha a 2FA aktív.
          </p>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {message && <p className="text-sm text-foreground">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Küldés…' : 'Visszaállító link kérése'}
          </button>
          <p className="text-center text-sm">
            <Link href="/admin/login" className="text-muted hover:text-foreground underline">
              Vissza a belépéshez
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}

export default function AdminResetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--card-bg)] p-4 text-muted">
          Betöltés…
        </div>
      }
    >
      <AdminResetForm />
    </Suspense>
  )
}
