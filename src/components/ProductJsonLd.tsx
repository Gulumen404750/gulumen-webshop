import type { Product } from '@/lib/data'
import { buildProductJsonLd } from '@/lib/product-json-ld'

export { buildProductJsonLd }

export function ProductJsonLd({ product }: { product: Product }) {
  const schema = buildProductJsonLd(product)
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
