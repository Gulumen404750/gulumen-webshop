'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useLocale } from '@/context/LocaleContext'
import { PointsDisplay } from '@/components/PointsDisplay'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { PointsProgress } from '@/components/PointsProgress'
import { PointsGuide } from '@/components/PointsGuide'
import { PointHistoryTimeline } from '@/components/PointHistoryTimeline'
import { LoyaltyTierBadge } from '@/components/LoyaltyTierBadge'

function BirthDateProfileSection() {
  const { t } = useLocale()
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/me/profile', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || 'Betöltési hiba')
        setBirthDate(typeof data.user?.birthDate === 'string' ? data.user.birthDate : '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Betöltési hiba'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate: birthDate.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Mentés sikertelen')
      setBirthDate(typeof data.user?.birthDate === 'string' ? data.user.birthDate : '')
      setMessage(t('profile.birthDateSaved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={save}
      className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-3"
    >
      <div>
        <label htmlFor="profile-birthDate" className="block text-sm font-medium text-foreground mb-1">
          {t('profile.birthDateLabel')}{' '}
          <span className="text-muted font-normal">({t('register.optionalLabel')})</span>
        </label>
        <input
          id="profile-birthDate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          disabled={loading || saving}
          className="w-full max-w-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground disabled:opacity-60"
          autoComplete="bday"
        />
        <p className="mt-1.5 text-xs text-muted leading-relaxed">{t('profile.birthDateHint')}</p>
      </div>
      {message && (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || saving}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        {saving ? t('profile.birthDateSaving') : t('profile.birthDateSave')}
      </button>
    </form>
  )
}

export default function ProfilePage() {
  const { t } = useLocale()
  const { isLoggedIn, userId, login, loginWithGoogle, logout } = useAuth()
  const { registrationStatus } = useCatCoupon()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('authError') || params.get('error')
    if (!code) return
    const keyMap: Record<string, string> = {
      db_not_configured: 'profile.authErrorDbNotConfigured',
      db_unreachable: 'profile.authErrorDbUnreachable',
      user_create_failed: 'profile.authErrorUserCreateFailed',
      google_email_missing: 'profile.authErrorGoogleEmailMissing',
      google: 'profile.authErrorOAuthProvider',
      AccessDenied: 'profile.authErrorAccessDenied',
      Configuration: 'profile.authErrorConfiguration',
      OAuthSignin: 'profile.authErrorConfiguration',
      OAuthCallback: 'profile.authErrorConfiguration',
      OAuthAccountNotLinked: 'profile.authErrorOAuthAccountNotLinked',
    }
    const message = t(keyMap[code] ?? 'profile.authErrorDefault')
    setAuthError(code === 'google' || code.startsWith('OAuth') ? `${message} (${code})` : message)
  }, [t])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    if (!email.trim()) return
    const result = await login(email.trim(), password)
    if (result.ok) router.push('/')
    else setLoginError(result.error ?? 'Bejelentkezés sikertelen')
  }

  /** Meglévő fiók: azonnali Google belépés, hozzájárulás / kupon nélkül. */
  const handleGoogleLogin = () => {
    loginWithGoogle({
      callbackUrl:
        typeof window !== 'undefined' ? `${window.location.origin}/profil` : '/profil',
    })
  }

  if (isLoggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('profile.title')}</h1>
        <p className="text-muted mb-4">{t('profile.loggedInAs')} {userId}</p>
        {userId && <LoyaltyTierBadge email={userId} className="mb-6" />}
        <BirthDateProfileSection />
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <PointsDisplay />
          <PointsProgress />
        </div>
        <PointsGuide className="mb-6" />
        <PointHistoryTimeline className="mb-6" />
        {registrationStatus === 'claimed' && (
          <p className="text-sm text-accent mb-4">{t('profile.registrationCouponActive')}</p>
        )}
        {registrationStatus === 'used' && (
          <p className="text-sm text-muted mb-4">{t('profile.registrationCouponUsed')}</p>
        )}
        <button
          type="button"
          onClick={async () => {
            await logout()
            router.push('/')
          }}
          className="px-4 py-2 bg-accent text-white font-medium rounded-lg hover:opacity-90"
        >
          {t('buttons.logout')}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">{t('profile.loginTitle')}</h1>
      <p className="text-muted mb-6">{t('profile.loginRequired')}</p>
      {authError && (
        <p className="mb-4 p-3 rounded-lg border border-red-300/50 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 text-sm" role="alert">
          {authError}
        </p>
      )}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
            {t('profile.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            placeholder="email@pelda.hu"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
            {t('profile.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        {loginError && (
          <p className="text-red-600 text-sm">{loginError}</p>
        )}
        <button
          type="submit"
          className="w-full py-3 px-4 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          {t('profile.loginCta')}
        </button>
        <div className="relative my-4">
          <span className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </span>
          <span className="relative flex justify-center text-xs uppercase text-muted">
            {t('profile.or') || 'vagy'}
          </span>
        </div>
        <GoogleSignInButton
          label={t('profile.loginWithGoogle') || 'Bejelentkezés Google-lel'}
          onClick={handleGoogleLogin}
        />
      </form>
      <p className="mt-6 text-sm text-muted">
        {t('profile.noAccount')}{' '}
        <Link href="/regisztracio" className="text-accent font-medium hover:underline">
          {t('profile.registerLink')}
        </Link>
      </p>
    </div>
  )
}
