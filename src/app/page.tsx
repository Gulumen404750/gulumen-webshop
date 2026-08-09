import type { Metadata } from 'next'
import { getAllProductsAsync } from '@/lib/data'
import {
  filterStorefrontProducts,
  getFeaturedProducts,
  getActiveDealProducts,
  getNewProducts,
} from '@/lib/storefront-config'
import HomePageClient from './HomePageClient'
import { buildLocalizedMetadata } from '@/lib/site-metadata'

export const revalidate = 10

export async function generateMetadata(): Promise<Metadata> {
  return buildLocalizedMetadata({ pathname: '/' })
}

export default async function HomePage() {
  const all = await getAllProductsAsync()
  const featuredProducts = getFeaturedProducts(all)
  const dealProducts = getActiveDealProducts(all)
  const newProducts = getNewProducts(all)
  const marqueeProducts = filterStorefrontProducts(all)
    .filter((p) => Boolean(p.image?.trim()))
    .slice(0, 24)

  return (
    <HomePageClient
      featuredProducts={featuredProducts}
      dealProducts={dealProducts}
      newProducts={newProducts}
      marqueeProducts={marqueeProducts}
    />
  )
}
