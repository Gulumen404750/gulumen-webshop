import type { Metadata } from 'next'
import { getProductBySlugAsync, getProductDescription } from '@/lib/data'
import { categories } from '@/lib/data'
import {
  getProductOgImageUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from '@/lib/product-og-image'

const SITE_NAME = 'Gulumen'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlugAsync(slug)
  if (!product) {
    return { title: 'Termék nem található – ' + SITE_NAME }
  }
  const title = `${product.name} – ${SITE_NAME}`
  const cat = categories.find((c) => c.slug === product.category)
  const categoryName = cat?.name ?? product.category
  const descText = getProductDescription(product, 'hu') || ''
  const description =
    descText.slice(0, 155) ||
    `${product.name}. ${categoryName}. ${product.condition}. ${(product.discountPriceHuf ?? product.priceHuf).toLocaleString('hu-HU')} Ft.`
  const canonical = `${BASE_URL}/termek/${encodeURIComponent(product.slug)}`
  const ogImageUrl = getProductOgImageUrl(product.slug)

  return {
    title,
    description,
    keywords: product.name ? [product.name, categoryName, product.condition, 'Gulumen', 'webshop'].filter(Boolean) : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: product.name,
        },
      ],
      locale: 'hu_HU',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: { canonical },
  }
}

export default async function ProductLayout({ params, children }: Props) {
  return <>{children}</>
}
