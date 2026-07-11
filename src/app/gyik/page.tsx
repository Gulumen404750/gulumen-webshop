'use client'

import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'

export default function FaqPage() {
  const { t } = useLocale()

  const sections = [
    {
      title: t('faq.sectionProducts'),
      items: [
        { q: t('home.faq1q'), a: t('home.faq1a') },
        { q: t('home.faq2q'), a: t('home.faq2a') },
        { q: t('faq.qMaterial'), a: t('faq.aMaterial') },
      ],
    },
    {
      title: t('faq.sectionOrders'),
      items: [
        { q: t('home.faq3q'), a: t('home.faq3a') },
        { q: t('faq.qShipping'), a: t('faq.aShipping') },
        { q: t('faq.qReturns'), a: t('faq.aReturns') },
      ],
    },
    {
      title: t('faq.sectionPayment'),
      items: [
        { q: t('home.faq4q'), a: t('home.faq4a') },
        { q: t('faq.qPayment'), a: t('faq.aPayment') },
      ],
    },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-3xl font-bold text-foreground mb-2">{t('nav.faq')}</h1>
      <p className="text-muted mb-10">{t('faq.intro')}</p>

      <div className="space-y-10">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-4">{section.title}</h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <details key={item.q} className="group rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
                  <summary className="px-5 py-4 font-medium text-foreground cursor-pointer list-none flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-muted group-open:rotate-180 transition-transform shrink-0 text-xs">▼</span>
                  </summary>
                  <p className="px-5 pb-4 text-muted text-sm leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-muted">
        {t('faq.stillQuestions')}{' '}
        <Link href="/kapcsolat" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
          {t('nav.contact')}
        </Link>
      </p>
    </div>
  )
}
