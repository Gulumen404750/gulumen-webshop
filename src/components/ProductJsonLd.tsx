import type { Product } from '@/lib/data'
import { categories, getProductDescription } from '@/lib/data'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

export function ProductJsonLd({ product }: { product: Product }) {
  const priceHuf = product.discountPriceHuf ?? product.priceHuf
  const cat = categories.find((c) => c.slug === product.category)
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: getProductDescription(product, 'hu') || product.name,
    image: product.image?.startsWith('/') ? `${BASE_URL}${product.image}` : undefined,
    sku: product.id,
    ...(cat && { category: cat.name }),
    brand: { '@type': 'Brand', name: 'Gulumen' },
    offers: {
      '@type': 'Offer',
      price: priceHuf,
      priceCurrency: 'HUF',
      availability: product.type === 'sourcing_deal' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock',
      url: `${BASE_URL}/termek/${product.slug}`,
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
