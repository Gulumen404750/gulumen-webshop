'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'

export default function ProfilePage() {
  const { t } = useLocale()
  const { isLoggedIn, userId, login, logout } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    const id = `user-${email.trim().toLowerCase().replace(/\s/g, '-')}`
    login(id)
    router.push('/')
  }

  if (isLoggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('profile.title')}</h1>
        <p className="text-muted mb-4">{t('profile.loggedInAs')} {userId}</p>
        <button
          type="button"
          onClick={() => {
            logout()
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
        <button
          type="submit"
          className="w-full py-3 px-4 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          {t('profile.loginCta')}
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
