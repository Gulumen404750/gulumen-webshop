import { Suspense } from 'react'
import { ShopContent } from '@/components/ShopContent'

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8 text-muted">Betöltés...</div>}>
      <ShopContent />
    </Suspense>
  )
}
