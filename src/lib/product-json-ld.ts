import type { Product } from '@/lib/data'
import { categories, getProductDescription } from '@/lib/data'
import { absoluteFirstPartyProductImages } from '@/lib/product-image-urls'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gulumen.com').replace(/\/$/, '')

export type ProductJsonLd = {
  '@context': string
  '@type': 'Product'
  name: string
  description: string
  image?: string | string[]
  sku: string
  category?: string
  brand: { '@type': string; name: string }
  offers: {
    '@type': string
    price: number
    priceCurrency: string
    availability: string
    url: string
  }
}

export function buildProductJsonLd(product: Product): ProductJsonLd {
  const priceHuf = product.discountPriceHuf ?? product.priceHuf
  const cat = categories.find((c) => c.slug === product.category)
  const images = absoluteFirstPartyProductImages(product)
  const schema: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: getProductDescription(product, 'hu') || product.name,
    sku: product.id,
    brand: { '@type': 'Brand', name: 'Gulumen' },
    offers: {
      '@type': 'Offer',
      price: priceHuf,
      priceCurrency: 'HUF',
      availability:
        product.type === 'sourcing_deal'
          ? 'https://schema.org/LimitedAvailability'
          : 'https://schema.org/InStock',
      url: `${BASE_URL}/termek/${product.slug}`,
    },
  }
  if (images.length === 1) schema.image = images[0]
  else if (images.length > 1) schema.image = images
  if (cat) schema.category = cat.name
  return schema
}
