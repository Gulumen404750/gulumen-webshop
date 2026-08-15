'use client'

import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'

const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL || 'postmaster@gulumen.com'
const LEGAL_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+36301234567'
const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME || 'Gulumen'
const LEGAL_ADDRESS = process.env.NEXT_PUBLIC_LEGAL_ADDRESS || ''

export default function AszfPage() {
  const { t } = useLocale()

  return (
    <div className="min-h-[60vh] bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-8">
          {t('pages.aszfTitle')}
        </h1>

        <div className="prose-legal space-y-8 text-foreground text-sm sm:text-base leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground">
              {t('pages.aszf.section1Title')}
            </h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-muted">{t('pages.aszf.operatorLabel')}</dt>
                <dd className="font-medium">{LEGAL_NAME}</dd>
              </div>
              <div>
                <dt className="text-muted">{t('pages.aszf.addressLabel')}</dt>
                <dd className="font-medium">
                  {LEGAL_ADDRESS.trim() || t('pages.aszf.addressPlaceholder')}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t('pages.aszf.emailLabel')}</dt>
                <dd>
                  <a href={`mailto:${LEGAL_EMAIL}`} className="text-accent hover:underline font-medium">
                    {LEGAL_EMAIL}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t('pages.aszf.phoneLabel')}</dt>
                <dd>
                  <a
                    href={`tel:${LEGAL_PHONE.replace(/\s/g, '')}`}
                    className="text-accent hover:underline font-medium"
                  >
                    {LEGAL_PHONE}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground">
              {t('pages.aszf.section2Title')}
            </h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>{t('pages.aszf.orderStep1')}</li>
              <li>{t('pages.aszf.orderStep2')}</li>
              <li>{t('pages.aszf.orderStep3')}</li>
              <li>{t('pages.aszf.orderStep4')}</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground">
              {t('pages.aszf.section3Title')}
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>{t('pages.aszf.paymentLabel')}</strong> {t('pages.aszf.paymentText')}
              </li>
              <li>
                <strong>{t('pages.aszf.shippingLabel')}</strong> {t('pages.aszf.shippingText')}{' '}
                <Link href="/szallitas" className="text-accent hover:underline">
                  {t('nav.shipping')}
                </Link>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground">
              {t('pages.aszf.section4Title')}
            </h2>
            <p>{t('pages.aszf.withdrawalIntro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('pages.aszf.withdrawalCost')}</li>
              <li>{t('pages.aszf.withdrawalCondition')}</li>
              <li>{t('pages.aszf.withdrawalRefund')}</li>
            </ul>
            <p>
              <Link href="/visszakuldes" className="text-accent hover:underline">
                {t('nav.returns')}
              </Link>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground">
              {t('pages.aszf.section5Title')}
            </h2>
            <p>{t('pages.aszf.warrantyText')}</p>
          </section>

          <p className="text-xs text-muted pt-4 border-t border-[var(--border)]">
            {t('pages.aszf.lastUpdated')}
          </p>
        </div>
      </div>
    </div>
  )
}
