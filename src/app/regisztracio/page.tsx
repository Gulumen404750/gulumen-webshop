'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useLocale } from '@/context/LocaleContext'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { getRegistrationCouponPercentDisplay } from '@/lib/coupon-config'

export default function RegistrationPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { isLoggedIn, register, loginWithGoogle } = useAuth()
  const { claimRegistrationCoupon } = useCatCoupon()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [acceptOffers, setAcceptOffers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponGranted, setCouponGranted] = useState(false)
  const registrationCouponPercent = getRegistrationCouponPercentDisplay()

  useEffect(() => {
    if (isLoggedIn) router.replace('/profil')
  }, [isLoggedIn, router])

  const handleGoogleRegister = () => {
    setError(null)
    if (!acceptPrivacy) {
      setError(t('register.errorPrivacy') || 'A regisztrációhoz fogadd el az adatkezelési tájékoztatót.')
      return
    }
    loginWithGoogle({
      ...(acceptOffers ? { acceptOffers: true } : {}),
      callbackUrl: typeof window !== 'undefined' ? `${window.location.origin}/termekek` : '/termekek',
    })
  }

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
    if (!acceptPrivacy) {
      setError(t('register.errorPrivacy') || 'A regisztrációhoz fogadd el az adatkezelési tájékoztatót.')
      return
    }
    const result = await register(trimmedEmail, password, undefined, acceptOffers)
    if (!result.ok) {
      const msg = result.error ?? ''
      const already =
        /már regisztráltak|already registered|already exists|409/i.test(msg) ||
        msg.includes('Ezzel az e-mail')
      setError(
        already
          ? t('register.errorEmailTaken') ||
            'Ezzel az e-mail címmel már regisztráltak. Jelentkezz be.'
          : msg || (t('register.errorGeneric') || 'Regisztráció sikertelen')
      )
      return
    }
    if (acceptOffers) {
      const uid = result.email ?? trimmedEmail
      const claimed = claimRegistrationCoupon(uid)
      if (claimed) setCouponGranted(true)
    }
    router.push('/termekek')
  }

  if (isLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-muted">{t('profile.loggedInAs')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
        {t('pages.registerTitle')}
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

        <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
          <input
            id="reg-privacy"
            type="checkbox"
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
            aria-describedby="reg-privacy-desc"
            required
          />
          <label id="reg-privacy-desc" htmlFor="reg-privacy" className="text-sm text-foreground cursor-pointer">
            {t('register.checkboxPrivacy')}{' '}
            <Link
              href="/kapcsolat#telefonos-adatkezeles"
              className="text-accent underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('register.privacyLink')}
            </Link>
            .
          </label>
        </div>

        {registrationCouponPercent > 0 && (
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
              {t('register.checkboxOffers', { percent: registrationCouponPercent })}
            </label>
          </div>
        )}

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
        <div className="relative my-2">
          <span className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </span>
          <span className="relative flex justify-center text-xs uppercase text-muted">
            {t('profile.or') || 'vagy'}
          </span>
        </div>
        <GoogleSignInButton
          label={t('register.withGoogle') || 'Regisztráció Google-lel'}
          onClick={handleGoogleRegister}
        />
      </form>
      <p className="mt-4 text-sm text-muted">
        {t('pages.registerHaveAccount')}{' '}
        <Link href="/profil" className="text-accent hover:underline font-medium">
          {t('buttons.login')}
        </Link>
      </p>
    </div>
  )
}
