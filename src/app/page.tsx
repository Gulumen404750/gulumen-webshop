'use client'

import Link from 'next/link'
import { getNewProducts, getDealProducts } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { HeroCat } from '@/components/HeroCat'
import { useLocale } from '@/context/LocaleContext'

export default function HomePage() {
  const { t, locale } = useLocale()
  const newProducts = getNewProducts()
  const dealProducts = getDealProducts()

  return (
    <>
      <section className="relative bg-background py-20 lg:py-28 overflow-hidden">
        <HeroCat />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground max-w-3xl mx-auto leading-tight">
            {t('home.heroTitle')}
          </h1>
          <div className="group inline-block mt-8">
            <Link
              href="/termekek"
              className="inline-block px-8 py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              {t('buttons.viewProducts')}
            </Link>
            <p className="mt-3 min-h-[1.5rem] text-center font-medium transition-all duration-300 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 flex-wrap">
              <span className="magic-gold-sparkle inline-block opacity-0 group-hover:opacity-100" aria-hidden>
                <MagicGoldIcon className="w-5 h-5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              </span>
              <span className="magic-gold-shimmer bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-300 bg-[length:200%_100%] bg-clip-text text-transparent">
                {t('home.catchTheCat')}
              </span>
              <span className="magic-gold-sparkle-delay inline-block opacity-0 group-hover:opacity-100" aria-hidden>
                <MagicGoldIcon className="w-5 h-5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-heading text-2xl font-bold text-foreground">{t('home.new')}</h2>
            <Link href="/ujdonsagok" className="text-accent font-medium hover:underline">
              {t('home.all')}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {newProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[var(--card-bg)] border-y border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-heading text-2xl font-bold text-foreground">{t('home.deals')}</h2>
            <Link href="/akciok" className="text-accent font-medium hover:underline">
              {t('home.allDeals')}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {dealProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-3">
                <TruckIcon className="w-6 h-6" />
              </div>
              <p className="font-heading font-semibold text-foreground">{t('home.trustDispatch')}</p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-3">
                <CardIcon className="w-6 h-6" />
              </div>
              <p className="font-heading font-semibold text-foreground">{t('home.trustPayment')}</p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-3">
                <ReturnIcon className="w-6 h-6" />
              </div>
              <p className="font-heading font-semibold text-foreground">{t('home.trustReturns')}</p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-3">
                <ChatIcon className="w-6 h-6" />
              </div>
              <p className="font-heading font-semibold text-foreground">{t('home.trustChat')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-8 lg:p-10 text-center">
            <h2 className="font-heading text-xl font-bold text-foreground">{t('home.registerTitle')}</h2>
            <p className="mt-2 text-muted">{t('home.registerDesc')}</p>
            <Link
              href="/regisztracio"
              className="inline-block mt-6 px-6 py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              {t('buttons.register')}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 01-1-1V4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1zm-3-1a1 1 0 001-1V6a1 1 0 00-1-1H9a1 1 0 00-1 1v8a1 1 0 001 1z" />
    </svg>
  )
}
function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}
function ReturnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

/** Varázs arany csillag a „Kapd el a macskát” szöveg mellett hoverre */
function MagicGoldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6L12 2z" />
    </svg>
  )
}
