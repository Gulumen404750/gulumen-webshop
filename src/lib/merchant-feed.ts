import type { Product } from '@/lib/data'
import { getProductDescription } from '@/lib/data'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'
const BRAND = 'Gulumen'

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function formatPriceHuf(product: Product): string {
  const price = product.discountPriceHuf ?? product.priceHuf
  return `${price} HUF`
}

function formatAvailability(stock: number): string {
  return stock > 0 ? 'in stock' : 'out of stock'
}

export function buildMerchantFeedXml(products: Product[]): string {
  const items = products
    .map((product) => {
      const description = getProductDescription(product, 'hu') || product.name
      return `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(absoluteUrl(`/termek/${product.slug}`))}</g:link>
      <g:image_link>${escapeXml(absoluteUrl(product.image))}</g:image_link>
      <g:price>${escapeXml(formatPriceHuf(product))}</g:price>
      <g:availability>${formatAvailability(product.stock)}</g:availability>
      <g:brand>${escapeXml(BRAND)}</g:brand>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(BRAND)}</title>
    <link>${escapeXml(BASE_URL)}</link>
    <description>${escapeXml('Gondosan válogatott, limitált darabszámú minőségi termékek')}</description>
${items}
  </channel>
</rss>`
}
