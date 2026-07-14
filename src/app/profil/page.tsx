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

  if (isLoggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('profile.title')}</h1>
        <p className="text-muted mb-4">{t('profile.loggedInAs')} {userId}</p>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <PointsDisplay />
          <PointsProgress />
        </div>
        <PointsGuide className="mb-6" />
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('profile.loginTitle')}</h1>
      <p className="text-muted mb-6">{t('profile.loginRequired')}</p>
      {authError && (
        <p className="mb-4 p-3 rounded-lg border border-red-300/50 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 text-sm" role="alert">
          {authError}
        </p>
      )}
      <form onSubmit={handleLogin} className="space-y-4 max-w-md">
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
          onClick={() => loginWithGoogle()}
        />
      </form>
      <p className="mt-6 text-muted">
        {t('profile.noAccount')}{' '}
        <Link href="/regisztracio" className="text-accent font-medium hover:underline">
          {t('profile.registerLink')}
        </Link>
      </p>
    </div>
  )
}
