'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { GiftPointClaimForm } from '@/components/GiftPointClaimForm'
import { GIFT_POINT_VALIDITY_DAYS } from '@/lib/gamification/constants'

type Preview = {
  status: string
  points: number | null
  validityDays: number
}

export function GiftPointClaimClient({ token }: { token: string }) {
  const { t } = useLocale()
  const { isLoggedIn, authChecked } = useAuth()
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/gift-points/claim?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!cancelled) {
          setPreview({
            status: typeof data.status === 'string' ? data.status : 'not_found',
            points: typeof data.points === 'number' ? data.points : null,
            validityDays: typeof data.validityDays === 'number' ? data.validityDays : GIFT_POINT_VALIDITY_DAYS,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setPreview({ status: 'not_found', points: null, validityDays: GIFT_POINT_VALIDITY_DAYS })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const pointsLabel = preview?.points
    ? `${preview.points.toLocaleString()} ${t('gamification.pointsUnit')}`
    : null

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">{t('giftClaim.pageTitle')}</h1>
        <p className="text-muted mt-2">{t('giftClaim.pageHint', { days: preview?.validityDays ?? GIFT_POINT_VALIDITY_DAYS })}</p>
      </div>

      {preview && preview.status !== 'available' && preview.status !== 'used' && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {preview.status === 'not_found' && t('giftClaim.previewNotFound')}
          {preview.status === 'inactive' && t('giftClaim.previewInactive')}
          {preview.status === 'expired' && t('giftClaim.previewExpired')}
          {preview.status === 'not_yet_valid' && t('giftClaim.previewNotYet')}
        </div>
      )}

      {pointsLabel && preview?.status === 'available' && (
        <p className="text-lg font-semibold text-foreground">
          {t('giftClaim.previewAvailable', { points: preview.points ?? 0 })}
        </p>
      )}

      {authChecked && (
        <GiftPointClaimForm initialToken={token} hideTokenInput />
      )}

      {isLoggedIn && preview?.status === 'used' && (
        <p className="text-sm text-muted">{t('giftClaim.previewUsed')}</p>
      )}
    </div>
  )
}
