'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { RegistrationConsentFields } from '@/components/RegistrationConsentFields'

type Props = {
  open: boolean
  onConfirm: (result: { acceptPrivacy: true; acceptOffers: boolean }) => void
}

/**
 * Felugró ablak új fiók (pl. első Google belépés) adatvédelmi hozzájárulásához.
 * Meglévő felhasználóknak soha nem jelenik meg.
 */
export function RegistrationConsentModal({ open, onConfirm }: Props) {
  const { t } = useLocale()
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [acceptOffers, setAcceptOffers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAcceptPrivacy(false)
    setAcceptOffers(false)
    setError(null)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptPrivacy) {
      setError(t('register.errorPrivacy'))
      return
    }
    onConfirm({ acceptPrivacy: true, acceptOffers })
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="registration-consent-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xl p-5 sm:p-6">
        <h2 id="registration-consent-title" className="font-heading text-lg font-bold text-foreground mb-2">
          {t('register.consentModalTitle')}
        </h2>
        <p className="text-sm text-muted mb-4">
          {t('register.consentModalIntro')}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <RegistrationConsentFields
            idPrefix="consent-modal"
            acceptPrivacy={acceptPrivacy}
            acceptOffers={acceptOffers}
            onPrivacyChange={setAcceptPrivacy}
            onOffersChange={setAcceptOffers}
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90"
          >
            {t('register.consentModalConfirm')}
          </button>
        </form>
      </div>
    </div>
  )
}
