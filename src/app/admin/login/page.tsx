'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RecaptchaNotice } from '@/components/RecaptchaNotice'
import { getRecaptchaToken } from '@/lib/recaptcha-browser'
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha-constants'

export default function AdminLoginPage() {
  const [key, setKey] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [step, setStep] = useState<'key' | 'totp'>('key')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/admin/dashboard'

  async function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const captchaToken = await getRecaptchaToken(RECAPTCHA_ACTIONS.adminLogin)
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, captchaToken }),
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
          setStep('key')
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
      {step === 'key' ? (
        <form onSubmit={handleKeySubmit} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Admin belépés</h1>
          <p className="text-sm text-muted">
            Először az API kulcsot add meg. A 2FA bekapcsolása után a következő képernyőn jön a Google Authenticator 6 jegyű kódja.
          </p>
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
            disabled={loading}
            className="w-full py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Belépés…' : 'Belépés'}
          </button>
          <RecaptchaNotice />
        </form>
      ) : (
        <form onSubmit={handleTotpSubmit} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Kétlépcsős azonosítás</h1>
          <p className="text-sm text-muted">
            Add meg a Google Authenticator 6 jegyű kódját.
          </p>
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
              setStep('key')
              setError('')
              setTotpCode('')
            }}
            className="w-full text-sm text-muted hover:text-foreground"
          >
            ← Vissza a kulcshoz
          </button>
        </form>
      )}
    </div>
  )
}
