import { getAllProductsAsync } from '@/lib/data'
import { getFeaturedProducts, getActiveDealProducts, getNewProducts } from '@/lib/storefront-config'
import HomePageClient from './HomePageClient'

export const revalidate = 10

export default async function HomePage() {
  const all = await getAllProductsAsync()
  const featuredProducts = getFeaturedProducts(all)
  const dealProducts = getActiveDealProducts(all)
  const newProducts = getNewProducts(all)

  return (
    <HomePageClient
      featuredProducts={featuredProducts}
      dealProducts={dealProducts}
      newProducts={newProducts}
    />
  )
}
