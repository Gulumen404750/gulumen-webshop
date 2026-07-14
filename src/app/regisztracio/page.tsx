'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useLocale } from '@/context/LocaleContext'

export default function RegistrationPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { register } = useAuth()
  const { claimRegistrationCoupon } = useCatCoupon()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptOffers, setAcceptOffers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponGranted, setCouponGranted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCouponGranted(false)
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError(t('register.errorEmail'))
      return
    }
    if (!password || password.length < 8) {
      setError(t('register.errorPassword') || 'A jelszónak legalább 8 karakter hosszúnak kell lennie.')
      return
    }
    if (!acceptOffers) {
      setError(t('register.errorOffers') || 'A 10%-os kuponhoz fogadd el a termékajánlatokat.')
      return
    }
    const result = await register(trimmedEmail, password)
    if (!result.ok) {
      setError(result.error ?? 'Regisztráció sikertelen')
      return
    }
    const uid = result.email ?? trimmedEmail
    const claimed = claimRegistrationCoupon(uid)
    if (claimed) setCouponGranted(true)
    router.push('/termekek')
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
        {t('home.registerTitle')}
      </h1>
      <p className="text-muted mb-6">{t('register.intro')}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-foreground mb-1">
            {t('profile.email')}
          </label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@pelda.hu"
            className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-foreground mb-1">
            {t('profile.password')}
          </label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            autoComplete="new-password"
          />
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <input
            id="reg-offers"
            type="checkbox"
            checked={acceptOffers}
            onChange={(e) => setAcceptOffers(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
            aria-describedby="reg-offers-desc"
          />
          <label id="reg-offers-desc" htmlFor="reg-offers" className="text-sm text-foreground cursor-pointer">
            {t('register.checkboxOffers')}
          </label>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {couponGranted && (
          <p className="text-sm text-green-700 dark:text-green-400" role="status">
            {t('register.couponGranted')}
          </p>
        )}
        <button
          type="submit"
          className="w-full py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90"
        >
          {t('buttons.register')}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {t('pages.registerHaveAccount')}{' '}
        <Link href="/profil" className="text-accent hover:underline">
          {t('buttons.login')}
        </Link>
      </p>
    </div>
  )
}
