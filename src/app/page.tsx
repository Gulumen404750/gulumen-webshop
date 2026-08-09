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
  title: 'Gulumen – Mindenre van egy jó ötletünk.',
  description:
    'Szerethető és hasznos kiegészítők a család minden tagjának, télen-nyáron. Nézz körül nálunk, és fedezd fel egyedi kínálatunkat!',
  openGraph: {
    title: 'Gulumen – Mindenre van egy jó ötletünk.',
    description:
      'Szerethető és hasznos kiegészítők a család minden tagjának, télen-nyáron. Nézz körül nálunk, és fedezd fel egyedi kínálatunkat!',
    images: [{ url: '/og-image.png', width: 1200, height: 1200, alt: 'Gulumen logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gulumen – Mindenre van egy jó ötletünk.',
    description:
      'Szerethető és hasznos kiegészítők a család minden tagjának, télen-nyáron. Nézz körül nálunk, és fedezd fel egyedi kínálatunkat!',
    images: ['/og-image.png'],
  },
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
