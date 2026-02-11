import Link from 'next/link'
import { mockProducts } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'

const newProducts = mockProducts.filter((p) => p.isNew)

export default function NewPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-8">Újdonságok</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {newProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {newProducts.length === 0 && (
        <p className="text-muted text-center py-12">Jelenleg nincs újdonság.</p>
      )}
    </div>
  )
}
