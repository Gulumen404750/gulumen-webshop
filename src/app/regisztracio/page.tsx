'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useLocale } from '@/context/LocaleContext'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { RegistrationConsentFields } from '@/components/RegistrationConsentFields'
import { localeNoticeText, type LocaleNotice } from '@/lib/locale-notice'

function safeNextPath(): string | null {
  if (typeof window === 'undefined') return null
  const nextRaw = new URLSearchParams(window.location.search).get('next')
  if (nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//')) return nextRaw
  return null
}

export default function RegistrationPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { isLoggedIn, register, loginWithGoogle } = useAuth()
  const { claimRegistrationCoupon } = useCatCoupon()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [acceptOffers, setAcceptOffers] = useState(false)
  const [birthDate, setBirthDate] = useState('')
  const [error, setError] = useState<LocaleNotice | null>(null)
  const [couponGranted, setCouponGranted] = useState(false)

  useEffect(() => {
    if (isLoggedIn) {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      const nextRaw = params.get('next')
      const next =
        nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/profil'
      router.replace(next)
    }
  }, [isLoggedIn, router])

  const handleGoogleRegister = async () => {
    setError(null)
    if (!acceptPrivacy) {
      setError({ key: 'register.errorPrivacy' })
      return
    }
    await loginWithGoogle({
      acceptPrivacy: true,
      ...(acceptOffers ? { acceptOffers: true } : {}),
      callbackUrl:
        typeof window !== 'undefined'
          ? `${window.location.origin}${safeNextPath() || '/termekek'}`
          : '/termekek',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCouponGranted(false)
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError({ key: 'register.errorEmail' })
      return
    }
    if (!password || password.length < 8) {
      setError({ key: 'register.errorPassword' })
      return
    }
    if (!acceptPrivacy) {
      setError({ key: 'register.errorPrivacy' })
      return
    }
    const result = await register(
      trimmedEmail,
      password,
      name.trim() || undefined,
      acceptOffers,
      birthDate.trim() || null
    )
    if (!result.ok) {
      setError({
        key: result.error === 'email_taken' ? 'register.errorEmailTaken' : 'register.errorGeneric',
      })
      return
    }
    if (acceptOffers) {
      const uid = result.email ?? trimmedEmail
      const claimed = claimRegistrationCoupon(uid)
      if (claimed) setCouponGranted(true)
    }
    const next = safeNextPath()
    if (next) {
      router.push(next)
      return
    }
    // Születési dátum mentve – profilon látja a rögzített állapotot (kupon csak születésnapon)
    if (birthDate.trim()) {
      router.push('/profil')
      return
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
            placeholder={t('common.emailPlaceholder')}
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
        <div>
          <label htmlFor="reg-name" className="block text-sm font-medium text-foreground mb-1">
            {t('register.nameLabel')}{' '}
            <span className="text-muted font-normal">({t('register.optionalLabel')})</span>
          </label>
          <input
            id="reg-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('register.namePlaceholder')}
            maxLength={80}
            className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            autoComplete="given-name"
          />
          <p className="mt-1.5 text-xs text-muted leading-relaxed">{t('register.nameHint')}</p>
        </div>
        <div>
          <label htmlFor="reg-birthDate" className="block text-sm font-medium text-foreground mb-1">
            {t('register.birthDateLabel')}{' '}
            <span className="text-muted font-normal">({t('register.optionalLabel')})</span>
          </label>
          <input
            id="reg-birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            autoComplete="bday"
          />
          <p className="mt-1.5 text-xs text-muted leading-relaxed">
            {t('register.birthDateHint')}
          </p>
        </div>

        <RegistrationConsentFields
          idPrefix="reg"
          acceptPrivacy={acceptPrivacy}
          acceptOffers={acceptOffers}
          onPrivacyChange={setAcceptPrivacy}
          onOffersChange={setAcceptOffers}
        />

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {localeNoticeText(t, error)}
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
            {t('profile.or')}
          </span>
        </div>
        <GoogleSignInButton
          label={t('register.withGoogle')}
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
