import { Suspense } from 'react'
import { ShopContent } from '@/components/ShopContent'
import { ProductListSkeleton } from '@/components/ProductListSkeleton'
import { getAllProductsAsync } from '@/lib/data'

export const revalidate = 60

export default async function ShopPage() {
  const allProducts = await getAllProductsAsync()
  const stockProducts = allProducts.filter((p) => p.type !== 'sourcing_deal')

  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ShopContent initialProducts={stockProducts} />
    </Suspense>
  )
}
