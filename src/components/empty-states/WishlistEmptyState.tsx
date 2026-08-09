import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { EmptyStateLayout } from './EmptyStateLayout'

function HeartIllustration() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M50 82s-28-18-28-40a16 16 0 0 1 28-10 16 16 0 0 1 28 10c0 22-28 40-28 40z"
        className="stroke-accent"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="var(--card-bg)"
      />
      <path
        d="M38 38c0-4 4-8 8-6 6 2 6 10 4 14-2 4-8 4-12 0"
        className="stroke-red-400"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <circle cx="68" cy="32" r="6" className="fill-red-400/20 stroke-red-400" strokeWidth="1.5" />
      <path d="M68 29v6M65 32h6" className="stroke-red-400" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function WishlistEmptyState() {
  const { t } = useLocale()

  return (
    <EmptyStateLayout illustration={<HeartIllustration />} description={t('wishlist.emptyStateHint')}>
      <Link
        href="/termekek"
        className="inline-block py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {t('wishlist.emptyStateCta')}
      </Link>
    </EmptyStateLayout>
  )
}
