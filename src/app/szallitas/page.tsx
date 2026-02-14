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
        <div className="text-gray-200 max-w-2xl space-y-6">
          <p className="whitespace-pre-line">{t('pages.shipping.fullDescription')}</p>
          <div>
            <p className="font-semibold text-white mb-1">{t('cart.blockSourcingTitle')}</p>
            <p className="whitespace-pre-line">{t('pages.shipping.sourcingFullDescription')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
