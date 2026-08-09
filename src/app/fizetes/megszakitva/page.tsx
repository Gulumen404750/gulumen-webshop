'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { resetPendingPointsAfterCancelledCheckout } from '@/lib/point-wallet-client'

export default function PaymentCancelPage() {
  const { t } = useLocale()

  // Félbeszakadt Stripe checkout: ne maradjon „levont” pont a fejlécben
  useEffect(() => {
    void resetPendingPointsAfterCancelledCheckout()
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
        {t('payment.cancelTitle')}
      </h1>
      <p className="text-muted mb-6">{t('payment.cancelMessage')}</p>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/kosar"
          className="inline-block py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          {t('payment.backToCart')}
        </Link>
        <Link
          href="/fizetes"
          className="inline-block py-3 px-6 border-2 border-[var(--border)] text-foreground font-heading font-semibold rounded-lg hover:bg-[var(--border)] transition-colors"
        >
          {t('payment.tryAgain')}
        </Link>
      </div>
    </div>
  )
}
