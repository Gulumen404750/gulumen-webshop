import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ShopContent } from '@/components/ShopContent'
import { ProductListSkeleton } from '@/components/ProductListSkeleton'
import { getAllProductsAsync } from '@/lib/data'
import { pageMetadata } from '@/lib/page-metadata'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/termekek', 'seo.productsTitle')
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
