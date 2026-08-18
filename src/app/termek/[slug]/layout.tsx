import type { Metadata } from 'next'
import { getProductBySlugAsync, getProductDescription, getProductName, getCategoryName, categories } from '@/lib/data'
import {
  getProductOgImageUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from '@/lib/product-og-image'
import { getServerLocale } from '@/lib/locale-server'
import { getConditionLabel } from '@/lib/condition-label'
import { BASE_URL, OG_LOCALE, buildLanguageAlternates, getSiteCopy } from '@/lib/site-metadata'
import { formatMoneyFromHuf } from '@/lib/display-money'
import { FALLBACK_HUF_PER_EUR } from '@/lib/euro-rate'

const SITE_NAME = 'Gulumen'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const locale = await getServerLocale()
  const copy = getSiteCopy(locale)
  const product = await getProductBySlugAsync(slug)
  if (!product) {
    return { title: copy.productNotFound }
  }
  const productName = getProductName(product, locale)
  const title = `${productName} – ${SITE_NAME}`
  const cat = categories.find((c) => c.slug === product.category)
  const categoryName = cat ? getCategoryName(cat, locale) : product.category
  const conditionLabel = getConditionLabel(product.condition, locale)
  const descText = getProductDescription(product, locale) || ''
  const priceLabel = formatMoneyFromHuf(
    product.discountPriceHuf ?? product.priceHuf,
    locale,
    FALLBACK_HUF_PER_EUR
  )
  const description =
    descText.slice(0, 155) ||
    `${productName}. ${categoryName}. ${conditionLabel}. ${priceLabel}.`
  const path = `/termek/${encodeURIComponent(product.slug)}`
  const canonical = `${BASE_URL}${path}`
  const ogImageUrl = getProductOgImageUrl(product.slug)

  return {
    title,
    description,
    keywords: productName ? [productName, categoryName, conditionLabel, 'Gulumen', 'webshop'].filter(Boolean) : undefined,
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
          alt: productName,
        },
      ],
      locale: OG_LOCALE[locale],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical,
      languages: buildLanguageAlternates(path),
    },
  }
}

export default async function ProductLayout({ params, children }: Props) {
  return <>{children}</>
}
