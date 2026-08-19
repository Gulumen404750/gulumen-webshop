import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { EmptyStateLayout } from './EmptyStateLayout'

function SearchIllustration() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="42" cy="42" r="22" className="stroke-accent" strokeWidth="2.5" fill="var(--card-bg)" />
      <path d="M58 58l18 18" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M34 42h16M42 34v16" className="stroke-muted" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

export function SearchNoResultsEmptyState({ query }: { query?: string }) {
  const { t } = useLocale()

  return (
    <EmptyStateLayout
      illustration={<SearchIllustration />}
      title={t('search.noResultsTitle')}
      description={
        query
          ? t('search.noResultsHintWithQuery', { query })
          : t('search.noResultsHint')
      }
    >
      <Link
        href="/termekek"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/40 bg-accent/5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
      >
        {t('buttons.browseProducts')}
      </Link>
    </EmptyStateLayout>
  )
}
