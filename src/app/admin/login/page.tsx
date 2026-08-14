'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import '@/lib/admin-fetch'
import { RecaptchaNotice } from '@/components/RecaptchaNotice'
import { readAdminPublicBase } from '@/lib/admin-public-base'
import { getRecaptchaToken } from '@/lib/recaptcha-browser'
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha-constants'
import { publicAdminUiPathFromBase, safeAdminReturnPath, slugFromPublicBase } from '@/lib/admin-url'

type LoginStep = 'key' | 'totp' | 'setup'

export default function AdminLoginPage() {
  const [key, setKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [step, setStep] = useState<LoginStep>('key')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = safeAdminReturnPath(searchParams.get('from'), slugFromPublicBase(readAdminPublicBase()))
  const resetHref = publicAdminUiPathFromBase('/admin/reset', readAdminPublicBase())

  async function startEnrollment() {
    const res = await fetch('/api/admin/2fa/setup', {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'A QR-kód generálása sikertelen.')
    }
    setQrDataUrl(data.qrDataUrl || null)
    setSecret(data.secret || null)
    setTotpCode('')
    setStep('setup')
  }

  async function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const captchaToken = await getRecaptchaToken(RECAPTCHA_ACTIONS.adminLogin)
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          username: username.trim() || undefined,
          password: password || undefined,
          captchaToken,
        }),
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
      if (data.requiresTwoFactorSetup) {
        await startEnrollment()
        return
      }
      setError('A belépéshez Google Authenticator kód kell.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba történt.')
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
        if (res.status === 403) {
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

  async function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: totpCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'A kód érvénytelen.')
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
            API kulcs (mindig kötelező) + Google Authenticator. Amíg nincs operátor, a kulcs elég a
            2FA-hoz – kivéve ha a <a href={resetHref} className="underline">/admin/reset</a> oldalon
            már beállítottál admin jelszót, mert az a kulcs mellett is kötelező. Ha már van operátor,
            kötelező a felhasználónév és a jelszó is (amit az Operátoroknál megadtál).
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
          <div>
            <label htmlFor="admin-username" className="block text-sm font-medium text-foreground mb-1">
              Felhasználónév (operátor)
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              placeholder="opcionális, amíg nincs operátor"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-foreground mb-1">
              Jelszó (operátor, vagy admin jelszó ha beállítottad a resetnél)
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              placeholder="opcionális, ha nincs operátor és nincs admin jelszó"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Belépés…' : 'Tovább'}
          </button>
          <p className="text-center text-sm">
            <a href={resetHref} className="text-muted hover:text-foreground underline">
              Elfelejtett jelszó
            </a>
          </p>
          <RecaptchaNotice />
        </form>
      ) : step === 'setup' ? (
        <form onSubmit={handleSetupSubmit} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Authenticator párosítása</h1>
          <p className="text-sm text-muted">
            Olvasd be a QR-kódot Google Authenticatorrel, majd add meg a 6 jegyű kódot. Addig nincs admin belépés.
          </p>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Google Authenticator QR-kód"
                className="w-44 h-44 rounded-lg border border-[var(--border)] bg-white"
              />
              {secret && (
                <code className="block w-full break-all rounded bg-[var(--border)]/40 px-2 py-1 font-mono text-xs text-center">
                  {secret}
                </code>
              )}
            </div>
          )}
          <div>
            <label htmlFor="admin-setup-totp" className="block text-sm font-medium text-foreground mb-1">
              Hitelesítő kód
            </label>
            <input
              id="admin-setup-totp"
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
            {loading ? 'Ellenőrzés…' : '2FA élesítése és belépés'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('key')
              setError('')
              setTotpCode('')
              setQrDataUrl(null)
              setSecret(null)
            }}
            className="w-full text-sm text-muted hover:text-foreground"
          >
            ← Vissza a kulcshoz
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
