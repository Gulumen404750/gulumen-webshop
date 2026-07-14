'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useLocale } from '@/context/LocaleContext'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
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
        <button
          type="button"
          onClick={loginWithGoogle}
          className="w-full py-3 px-4 border-2 border-[var(--border)] bg-background text-foreground font-heading font-semibold rounded-lg hover:bg-[var(--border)]/30 transition-colors flex items-center justify-center gap-2"
        >
          <GoogleIcon className="w-5 h-5" />
          {t('profile.loginWithGoogle') || 'Bejelentkezés Google-lel'}
        </button>
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
