'use client'

import Image from 'next/image'
import { useLocale } from '@/context/LocaleContext'

/** Fix konstans – a linket TILOS fordítani vagy i18n alá tenni. Minden nyelven ugyanaz marad. */
const EU_LEGAL_LINK = 'https://europa.eu/youreurope/citizens/consumers/shopping/shopping-consumer-rights/index_en.htm'

export default function ReturnsPage() {
  const { t } = useLocale()

  return (
    <div className="relative min-h-screen flex items-center">
      <div className="absolute inset-0">
        <Image
          src="/img/visszakuldes-background.png"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden />
      </div>
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-6">
          {t('pages.returnsTitle')}
        </h1>
        <div className="text-gray-200 space-y-4 max-w-2xl">
          <p>{t('pages.returns.intro')}</p>
          <p>{t('pages.returns.withdrawalParagraph')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">{t('pages.returns.costBullet')}</strong>
            </li>
            <li>
              <strong className="text-white">{t('pages.returns.refundBullet')}</strong>
            </li>
          </ul>
          <p>{t('pages.returns.examinationRight')}</p>
          <p>{t('pages.returns.valueReductionBullet')}</p>
          <p>{t('pages.returns.damagedRefundBullet')}</p>
          <p>{t('pages.returns.contact')}</p>

          <h2 className="font-heading text-lg font-semibold text-white mt-8 mb-2">{t('pages.returns.sourcingTitle')}</h2>
          <p>{t('pages.returns.sourcingIntro')}</p>
          <p>{t('pages.returns.sourcingDelivery')}</p>
          <p>{t('pages.returns.sourcingCancel')}</p>
          <p>{t('pages.returns.sourcingDeduction')}</p>
          <p>{t('pages.returns.sourcingFullRefund')}</p>

          <p className="pt-4">
            {t('pages.returns.legalIntro')}
            <br />
            {t('pages.returns.legalLinkLabel')}{' '}
            <a
              href={EU_LEGAL_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline hover:no-underline"
            >
              {EU_LEGAL_LINK}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
