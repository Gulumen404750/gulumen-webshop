import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ShopContent } from '@/components/ShopContent'
import { ProductListSkeleton } from '@/components/ProductListSkeleton'
import { getAllProductsAsync, categories, getCategoryName } from '@/lib/data'
import { getRequestLocale } from '@/lib/locale-server'
import {
  buildPageMetadata,
  categoryMetaDescription,
  categoryMetaTitle,
  getSiteDescription,
  productsMetaTitle,
} from '@/i18n/seo'

export const revalidate = 10

type Props = {
  searchParams: Promise<{ kategoria?: string; sub?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const locale = await getRequestLocale()
  const params = await searchParams
  const slug = params.kategoria ?? ''
  const cat = slug ? categories.find((c) => c.slug === slug) : null
  const search = slug ? `?kategoria=${encodeURIComponent(slug)}` : ''

  if (cat) {
    const name = getCategoryName(cat, locale)
    return buildPageMetadata({
      locale,
      title: categoryMetaTitle(name, locale),
      description: categoryMetaDescription(name, locale),
      internalPath: '/termekek',
      search,
    })
  }

  return buildPageMetadata({
    locale,
    title: productsMetaTitle(locale),
    description: getSiteDescription(locale),
    internalPath: '/termekek',
  })
}

export default async function ShopPage() {
  const allProducts = await getAllProductsAsync()
  const stockProducts = allProducts.filter((p) => p.type !== 'sourcing_deal')

  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ShopContent initialProducts={stockProducts} />
    </Suspense>
  )
}
