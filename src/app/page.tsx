import type { Metadata } from 'next'
import { getAllProductsAsync } from '@/lib/data'
import {
  filterStorefrontProducts,
  getFeaturedProducts,
  getActiveDealProducts,
  getNewProducts,
} from '@/lib/storefront-config'
import HomePageClient from './HomePageClient'

export const revalidate = 10

export const metadata: Metadata = {
  title: 'Gulumen – Télen, nyáron, veletek – mint egy nagy család',
  description:
    'Kedves, családias webáruház mindenkinek: praktikus és szerethető dolgok a konyhába, gyerekszobába, íróasztalra és az otthon minden szegletébe. Télen-nyáron veletek vagyunk!',
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
