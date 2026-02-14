'use client'

import { useState } from 'react'
import type { Product } from '@/lib/data'
import { useLocale } from '@/context/LocaleContext'

const tabs = [
  { id: 'leiras', label: 'Leírás' },
  { id: 'szallitas', label: 'Szállítás' },
  { id: 'visszakuldes', label: 'Visszaküldés' },
] as const

export function ProductTabs({ product }: { product: Product }) {
  const { t } = useLocale()
  const [active, setActive] = useState<(typeof tabs)[number]['id']>('leiras')

  return (
    <div>
      <div className="flex border-b border-[var(--border)] gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`py-2 px-1 border-b-2 -mb-px font-medium text-sm transition-colors ${
              active === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4 text-muted text-sm">
        {active === 'leiras' && <p>{product.description}</p>}
        {active === 'szallitas' && (
          <p className="whitespace-pre-line">
            {product.type === 'sourcing_deal'
              ? t('pages.shipping.sourcingFullDescription')
              : t('pages.shipping.fullDescription')}
          </p>
        )}
        {active === 'visszakuldes' && (
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('pages.returns.costBullet')}</li>
            <li>{t('pages.returns.refundBullet')}</li>
            <li>{t('pages.returns.damagedRefundBullet')}</li>
            <li>{t('pages.returns.intro')}</li>
          </ul>
        )}
      </div>
    </div>
  )
}
