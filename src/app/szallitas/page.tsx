'use client'

import Image from 'next/image'
import { useLocale } from '@/context/LocaleContext'

export default function ShippingPage() {
  const { t } = useLocale()

  return (
    <div className="relative min-h-[60vh] flex items-center">
      <div className="absolute inset-0">
        <Image
          src="/img/szallitas-background.png"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-black/60" aria-hidden />
      </div>
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-6">
          {t('pages.shippingTitle')}
        </h1>
        <div className="text-gray-200 space-y-4 max-w-2xl">
          <p>{t('pages.shipping.intro')}</p>
          <p>
            <strong className="text-white">{t('pages.shipping.freeShipping')}</strong>
          </p>
          <p>
            <strong className="text-white">{t('pages.shipping.dispatch')}</strong>
          </p>
          <p>{t('pages.shipping.noPickup')}</p>
          <p>{t('pages.shipping.notify')}</p>
          <p className="pt-2 border-t border-white/20 mt-6">
            <strong className="text-white">{t('pages.shipping.sourcingNoteLabel')}</strong>{' '}
            {t('pages.shipping.sourcingNote')}
          </p>
        </div>
      </div>
    </div>
  )
}
