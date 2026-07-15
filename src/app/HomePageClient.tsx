'use client'

import Link from 'next/link'
import type { Product } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { FeaturedProductsGrid } from '@/components/FeaturedProductsGrid'
import { HeroCat } from '@/components/HeroCat'
import { RecentlyViewed } from '@/components/RecentlyViewed'
import { useLocale } from '@/context/LocaleContext'
import { useAuth } from '@/context/AuthContext'
import { getRegistrationCouponPercentDisplay } from '@/lib/coupon-config'

type Props = {
  featuredProducts: Product[]
  dealProducts: Product[]
  newProducts: Product[]
}

export default function HomePageClient({ featuredProducts, dealProducts, newProducts }: Props) {
  const { t } = useLocale()
  const { isLoggedIn, authChecked } = useAuth()
  const showRegisterCta = authChecked && !isLoggedIn
  const registrationCouponPercent = getRegistrationCouponPercentDisplay()

  const faqItems = [
    { q: t('home.faq1q'), a: t('home.faq1a') },
    { q: t('home.faq2q'), a: t('home.faq2a') },
    { q: t('home.faq3q'), a: t('home.faq3a') },
    { q: t('home.faq4q'), a: t('home.faq4a') },
  ]

  const reviews = [
    { name: t('home.review1name'), text: t('home.review1text'), stars: 5 },
    { name: t('home.review2name'), text: t('home.review2text'), stars: 5 },
    { name: t('home.review3name'), text: t('home.review3text'), stars: 5 },
  ]

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-indigo-950/5 via-background to-background py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl" />
        </div>
        <HeroCat />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <p className="text-sm font-medium tracking-widest uppercase text-indigo-600 dark:text-indigo-400 mb-4">
            {t('home.heroBadge')}
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground max-w-4xl mx-auto leading-tight">
            {t('home.heroTitle')}
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
            {t('home.heroSubtitle')}
          </p>
          <div className="mt-10 flex flex-col items-center gap-6">
            <Link
              href="/termekek?kategoria=3d-nyomtatott"
              className="inline-block px-8 py-3.5 bg-indigo-600 text-white font-heading font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
            >
              {t('home.heroCta')}
            </Link>

            {showRegisterCta && registrationCouponPercent > 0 && (
              <div className="register-cta-blink w-full max-w-2xl rounded-2xl border-2 border-[var(--border)] bg-[var(--card-bg)]/90 backdrop-blur-sm p-6 sm:p-8 text-center">
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground leading-snug">
                  {t('register.firstPurchasePromo', { percent: registrationCouponPercent })}
                </h2>
                <p className="mt-2 text-sm sm:text-base text-muted leading-relaxed">{t('home.registerDesc')}</p>
                <Link
                  href="/regisztracio"
                  className="inline-block mt-5 px-8 py-3 bg-accent text-white font-heading font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  {t('buttons.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bemutatkozás */}
      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">{t('home.introTitle')}</h2>
          <p className="mt-4 text-muted text-lg leading-relaxed">{t('home.introText')}</p>
        </div>
      </section>

      {/* Kiemelt termékek */}
      <section className="py-16 bg-[var(--card-bg)] border-y border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">{t('home.featuredTitle')}</h2>
              <p className="mt-1 text-muted text-sm">{t('home.featuredSubtitle')}</p>
            </div>
            <Link href="/termekek?kategoria=3d-nyomtatott" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline shrink-0">
              {t('home.all')}
            </Link>
          </div>
          <FeaturedProductsGrid
            initialProducts={featuredProducts}
            newProducts={newProducts}
            dealProducts={dealProducts}
          />
        </div>
      </section>

      {/* Akciók */}
      {dealProducts.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-10">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">{t('home.deals')}</h2>
              <Link href="/akciok" className="text-discount font-medium hover:underline">
                {t('home.allDeals')}
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {dealProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Miért minket */}
      <section className="py-16 lg:py-20 bg-[var(--card-bg)] border-y border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
            {t('home.whyUsTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: '🖨️', title: t('home.whyUs1Title'), text: t('home.whyUs1Text') },
              { icon: '✨', title: t('home.whyUs2Title'), text: t('home.whyUs2Text') },
              { icon: '🎨', title: t('home.whyUs3Title'), text: t('home.whyUs3Text') },
              { icon: '🚀', title: t('home.whyUs4Title'), text: t('home.whyUs4Text') },
            ].map((item) => (
              <div key={item.title} className="text-center p-6 rounded-2xl border border-[var(--border)] bg-background">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-heading font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vélemények */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
            {t('home.reviewsTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <blockquote key={r.name} className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]">
                <div className="flex gap-0.5 mb-3" aria-hidden>
                  {Array.from({ length: r.stars }).map((_, i) => (
                    <span key={i} className="text-amber-400">★</span>
                  ))}
                </div>
                <p className="text-foreground leading-relaxed">&ldquo;{r.text}&rdquo;</p>
                <footer className="mt-4 text-sm font-medium text-muted">— {r.name}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* GYIK */}
      <section className="py-16 bg-[var(--card-bg)] border-y border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
            {t('home.faqTitle')}
          </h2>
          <div className="space-y-4">
            {faqItems.map((item) => (
              <details key={item.q} className="group rounded-xl border border-[var(--border)] bg-background overflow-hidden">
                <summary className="px-5 py-4 font-medium text-foreground cursor-pointer list-none flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-muted group-open:rotate-180 transition-transform shrink-0">▼</span>
                </summary>
                <p className="px-5 pb-4 text-muted text-sm leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="text-center mt-8">
            <Link href="/gyik" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              {t('home.faqMore')}
            </Link>
          </p>
        </div>
      </section>

      {/* Kapcsolat */}
      <section id="kapcsolat" className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">{t('home.contactTitle')}</h2>
          <p className="mt-4 text-muted text-lg">{t('home.contactText')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/kapcsolat"
              className="inline-block px-8 py-3 bg-indigo-600 text-white font-heading font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              {t('nav.contact')}
            </Link>
            <Link
              href="/szallitas"
              className="inline-block px-8 py-3 border border-[var(--border)] text-foreground font-medium rounded-xl hover:bg-[var(--border)]/50 transition-colors"
            >
              {t('nav.shipping')}
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-10 border-y border-[var(--border)] bg-[var(--card-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-sm text-muted">
          <div>
            <p className="font-medium text-foreground">{t('home.trustDispatch')}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t('home.trustPayment')}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t('home.trustReturns')}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t('home.trustChat')}</p>
          </div>
        </div>
      </section>

      <RecentlyViewed />
    </>
  )
}
