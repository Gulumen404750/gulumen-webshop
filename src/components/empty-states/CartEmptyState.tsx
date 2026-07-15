import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { EmptyStateLayout } from './EmptyStateLayout'

function CartIllustration() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="28" y="36" width="64" height="48" rx="8" className="stroke-accent" strokeWidth="2" strokeDasharray="6 4" fill="var(--card-bg)" />
      <path
        d="M40 36V28a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v8"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="44" cy="88" r="5" className="fill-accent/30 stroke-accent" strokeWidth="2" />
      <circle cx="76" cy="88" r="5" className="fill-accent/30 stroke-accent" strokeWidth="2" />
      <path d="M52 56h16M60 48v16" className="stroke-muted" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function CartEmptyState() {
  const { t } = useLocale()

  return (
    <EmptyStateLayout
      illustration={<CartIllustration />}
      title={t('cart.emptyStateTitle')}
      description={t('cart.empty')}
    >
      <Link
        href="/akciok"
        className="inline-block py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {t('cart.emptyStateCta')}
      </Link>
    </EmptyStateLayout>
  )
}
