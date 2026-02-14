import { Suspense } from 'react'
import { ShopContent } from '@/components/ShopContent'
import { ProductListSkeleton } from '@/components/ProductListSkeleton'

export default function ShopPage() {
  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ShopContent />
    </Suspense>
  )
}
