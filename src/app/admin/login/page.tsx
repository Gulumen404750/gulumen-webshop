'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AdminLoginPage() {
  const [key, setKey] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/admin/dashboard'

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, key }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Bejelentkezés sikertelen.')
        return
      }
      if (data.requiresTwoFactor) {
        setStep('totp')
        setTotpCode('')
        return
      }
      router.push(from)
      router.refresh()
    } catch {
      setError('Hiba történt.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: totpCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'A kód érvénytelen.')
        if (res.status === 401 && String(data?.error || '').includes('lejárt')) {
          setStep('credentials')
        }
        return
      }
      router.push(from)
      router.refresh()
    } catch {
      setError('Hiba történt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--card-bg)] p-4">
      {step === 'credentials' ? (
        <form onSubmit={handleCredentialsSubmit} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Admin belépés</h1>
          <p className="text-sm text-muted">
            Ha van admin jelszó, azzal lépj be. Az API kulcs vészhelyzeti belépés marad. 2FA után a
            hitelesítő alkalmazás kódja kell.
          </p>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-foreground mb-1">
              Jelszó
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="admin-key" className="block text-sm font-medium text-foreground mb-1">
              API kulcs
            </label>
            <input
              id="admin-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              placeholder="ADMIN_API_KEY"
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || (!password && !key)}
            className="w-full py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Belépés…' : 'Belépés'}
          </button>
          <p className="text-center text-sm">
            <Link href="/admin/reset" className="text-muted hover:text-foreground underline">
              Elfelejtett jelszó
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleTotpSubmit} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Kétlépcsős azonosítás</h1>
          <p className="text-sm text-muted">Add meg a Google Authenticator 6 jegyű kódját.</p>
          <div>
            <label htmlFor="admin-totp" className="block text-sm font-medium text-foreground mb-1">
              Hitelesítő kód
            </label>
            <input
              id="admin-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground tracking-[0.4em] text-center text-lg"
              placeholder="000000"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || totpCode.length !== 6}
            className="w-full py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Ellenőrzés…' : 'Megerősítés'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('credentials')
              setError('')
              setTotpCode('')
            }}
            className="w-full text-sm text-muted hover:text-foreground"
          >
            ← Vissza a belépéshez
          </button>
        </form>
      )}
    </div>
  )
}
