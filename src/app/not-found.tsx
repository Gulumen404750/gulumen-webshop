'use client'

import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'

export default function NotFound() {
  const { t } = useLocale()

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16">
      <h1 className="font-heading text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-muted text-lg mb-8 text-center max-w-md">
        {t('notFound.message')}
      </p>
      <div className="flex flex-wrap justify-center gap-4 mb-10">
        <Link
          href="/"
          className="px-6 py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          {t('common.home')}
        </Link>
        <Link
          href="/termekek"
          className="px-6 py-3 border-2 border-[var(--border)] text-foreground font-heading font-semibold rounded-lg hover:bg-[var(--border)] transition-colors"
        >
          {t('nav.products')}
        </Link>
        <Link
          href="/termekek"
          className="px-6 py-3 border-2 border-[var(--border)] text-foreground font-heading font-semibold rounded-lg hover:bg-[var(--border)] transition-colors"
        >
          {t('nav.deals')}
        </Link>
        <Link
          href="/ujdonsagok"
          className="px-6 py-3 border-2 border-[var(--border)] text-foreground font-heading font-semibold rounded-lg hover:bg-[var(--border)] transition-colors"
        >
          {t('nav.new')}
        </Link>
      </div>
      <form action="/termekek" method="get" className="w-full max-w-sm">
        <label htmlFor="not-found-search" className="sr-only">
          {t('common.search')}
        </label>
        <div className="flex gap-2">
          <input
            id="not-found-search"
            type="search"
            name="kereses"
            placeholder={t('common.searchPlaceholder')}
            className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-white font-medium rounded-lg hover:opacity-90"
          >
            {t('common.search')}
          </button>
        </div>
      </form>
    </div>
  )
}
