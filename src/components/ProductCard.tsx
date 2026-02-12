'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { Product } from '@/lib/data'
import { getSourcingDealStatus, getProductName } from '@/lib/data'
import { SourcingDealCardCountdown } from '@/components/SourcingDealCardCountdown'
import { useLocale } from '@/context/LocaleContext'
import { useEuroRate } from '@/context/EuroRateContext'

function SourcingDealBadge({ product, t }: { product: Product; t: (k: string) => string }) {
  if (product.type !== 'sourcing_deal') return null
  const status = getSourcingDealStatus(product)
  const labels: Record<string, string> = {
    preview: t('status.badgePreview'),
    sale: t('status.badgeSale'),
    soldout: t('status.badgeSoldout'),
    closed: t('status.badgeClosed'),
  }
  const label = status ? labels[status] : t('status.badgeSoon')
  const bg = !status ? 'bg-muted' : status === 'sale' ? 'bg-accent' : status === 'preview' ? 'bg-amber-500' : 'bg-muted'
  return (
    <span className={`absolute top-3 left-3 px-2 py-1 text-xs font-medium ${bg} text-white rounded`}>
      {label}
    </span>
  )
}

export function ProductCard({ product, sourcingListMode }: { product: Product; sourcingListMode?: boolean }) {
  const { t, locale } = useLocale()
  const { hufToEur, formatEur } = useEuroRate()
  const priceHuf = product.discountPriceHuf ?? product.priceHuf
  const priceEur = hufToEur(priceHuf)
  const hasDiscount = !!product.discountPriceHuf
  const hasImage = product.image?.startsWith('/')
  const displayName = getProductName(product, locale)

  return (
    <Link href={`/termek/${product.slug}`} className="group block">
      <article className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden transition-shadow hover:shadow-lg">
        <div className="aspect-square bg-[var(--border)] relative overflow-hidden">
          {hasImage ? (
            <Image src={product.image} alt={displayName} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-muted text-sm">
              {t('product.noImage')}
            </div>
          )}
          {product.type === 'sourcing_deal' && <SourcingDealBadge product={product} t={t} />}
          {product.onSale && product.type !== 'sourcing_deal' && (
            <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-discount text-white rounded">
              {t('status.deal')}
            </span>
          )}
          {product.isNew && !product.onSale && product.type !== 'sourcing_deal' && (
            <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-accent text-white rounded">
              {t('status.new')}
            </span>
          )}
        </div>
        {product.type === 'sourcing_deal' && (
          <SourcingDealCardCountdown product={product} />
        )}
        <div className="p-4">
          <h3 className="font-heading font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-2">
            {displayName}
          </h3>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            {hasDiscount && (
              <span className="text-sm text-muted line-through">
                {product.priceHuf.toLocaleString('hu-HU')} Ft
              </span>
            )}
            <span className={hasDiscount ? 'text-discount font-semibold' : 'text-foreground font-semibold'}>
              {priceHuf.toLocaleString('hu-HU')} Ft
            </span>
            <span className="text-sm text-muted">
              (€{formatEur(priceEur)})
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{product.condition}</p>
          {product.type === 'sourcing_deal' ? (
            <p className="mt-0.5 text-xs text-muted">{t('product.sourcingCardLabel')}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted">{t('product.stockLabel')}</p>
          )}
        </div>
      </article>
    </Link>
  )
}
