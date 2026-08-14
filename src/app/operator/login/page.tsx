'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import '@/lib/admin-fetch'
import { RecaptchaNotice } from '@/components/RecaptchaNotice'
import { readAdminPublicBase } from '@/lib/admin-public-base'
import { getRecaptchaToken } from '@/lib/recaptcha-browser'
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha-constants'
import { publicAdminUiPathFromBase } from '@/lib/admin-url'

/**
 * Másodlagos operátor belépés: felhasználónév + jelszó.
 * A session `operator_authorized` sütibe kerül — nem írja felül az owner sessiont.
 */
export default function OperatorLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const dashboardHref = publicAdminUiPathFromBase('/admin/dashboard', readAdminPublicBase())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const captchaToken = await getRecaptchaToken(RECAPTCHA_ACTIONS.adminLogin)
      const res = await fetch('/api/operator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          password,
          captchaToken,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Bejelentkezés sikertelen.')
        return
      }
      router.push(dashboardHref)
      router.refresh()
    } catch {
      setError('Hiba történt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--card-bg)] p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Operátor belépés</h1>
        <p className="text-sm text-muted">
          Másodlagos fiók (felhasználónév + jelszó). Ez a session nem írja felül az owner
          böngészőbeli sessionjét. Főadmin:{' '}
          <a href="/admin/login" className="underline">
            /admin/login
          </a>
          .
        </p>
        <div>
          <label htmlFor="operator-username" className="block text-sm font-medium text-foreground mb-1">
            Felhasználónév
          </label>
          <input
            id="operator-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label htmlFor="operator-password" className="block text-sm font-medium text-foreground mb-1">
            Jelszó
          </label>
          <input
            id="operator-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            autoComplete="current-password"
            required
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
    </div>
  )
}
