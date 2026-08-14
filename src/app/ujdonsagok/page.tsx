import { getAllProductsAsync } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { PageEmptyMessage, PageHeading } from '@/components/PageHeading'
import type { Metadata } from 'next'
import { buildLocalizedMetadata, getSiteCopy } from '@/lib/site-metadata'
import { getServerLocale } from '@/lib/locale-server'
import { getTranslations, t } from '@/i18n/translations'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getTranslations(locale)
  const copy = getSiteCopy(locale)
  return buildLocalizedMetadata({
    pathname: '/ujdonsagok',
    title: `${t(dict, 'pages.newTitle')} – Gulumen`,
    description: copy.description,
  })
}

export default async function NewPage() {
  const all = await getAllProductsAsync()
  const newProducts = all.filter((p) => p.isNew && p.type !== 'sourcing_deal')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeading titleKey="pages.newTitle" />
      <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {newProducts.map((p, i) => (
          <div key={p.id} className="min-w-0 w-full">
            <ProductCard product={p} priority={i < 4} />
          </div>
        ))}
      </div>
      {newProducts.length === 0 && <PageEmptyMessage messageKey="pages.newEmpty" />}
    </div>
  )
}
