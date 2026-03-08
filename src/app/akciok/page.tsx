import { getAllProductsAsync } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'

export const revalidate = 60

export default async function DealsPage() {
  const allProducts = await getAllProductsAsync()
  const dealProducts = allProducts.filter((p) => p.onSale && p.type !== 'sourcing_deal')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-8">Akciók</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dealProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {dealProducts.length === 0 && (
        <p className="text-muted text-center py-12">Jelenleg nincs akciós termék. Az adminban a termék szerkesztésnél kapcsold be az „Akciós” jelölőt.</p>
      )}
    </div>
  )
}
