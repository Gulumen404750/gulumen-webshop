'use client'

import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { getRegistrationCouponPercentDisplay } from '@/lib/coupon-config'

type Props = {
  acceptPrivacy: boolean
  acceptOffers: boolean
  onPrivacyChange: (value: boolean) => void
  onOffersChange: (value: boolean) => void
  idPrefix?: string
}

/**
 * Új regisztráció / első Google belépés hozzájárulás mezői:
 * - kötelező ÁSZF + adatkezelés
 * - opcionális 10% kupon + ajánlat e-mailek
 */
export function RegistrationConsentFields({
  acceptPrivacy,
  acceptOffers,
  onPrivacyChange,
  onOffersChange,
  idPrefix = 'reg-consent',
}: Props) {
  const { t } = useLocale()
  const percent = getRegistrationCouponPercentDisplay()
  const privacyId = `${idPrefix}-privacy`
  const offersId = `${idPrefix}-offers`

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
        <input
          id={privacyId}
          type="checkbox"
          checked={acceptPrivacy}
          onChange={(e) => onPrivacyChange(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
          aria-describedby={`${privacyId}-desc`}
          required
        />
        <label id={`${privacyId}-desc`} htmlFor={privacyId} className="text-sm text-foreground cursor-pointer">
          <span className="font-medium text-foreground">{t('register.requiredLabel') || 'Kötelező'}: </span>
          {t('register.checkboxPrivacy')}{' '}
          <Link
            href="/kapcsolat#telefonos-adatkezeles"
            className="text-accent underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {t('register.privacyLink')}
          </Link>
          .
        </label>
      </div>

      {percent > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <input
            id={offersId}
            type="checkbox"
            checked={acceptOffers}
            onChange={(e) => onOffersChange(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
            aria-describedby={`${offersId}-desc`}
          />
          <label id={`${offersId}-desc`} htmlFor={offersId} className="text-sm text-foreground cursor-pointer">
            <span className="font-medium text-muted">{t('register.optionalLabel') || 'Opcionális'}: </span>
            {t('register.checkboxOffers', { percent })}
          </label>
        </div>
      )}
    </div>
  )
}
