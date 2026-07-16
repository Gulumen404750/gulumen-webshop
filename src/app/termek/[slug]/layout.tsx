import type { Metadata } from 'next'
import { getProductBySlugAsync, getProductDescription, getProductName } from '@/lib/data'
import { categories, getCategoryName } from '@/lib/data'
import { getRequestLocale } from '@/lib/locale-server'
import { buildPageMetadata, SITE_NAME } from '@/i18n/seo'
import { BASE_URL } from '@/i18n/seo'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const locale = await getRequestLocale()
  const product = await getProductBySlugAsync(slug)
  if (!product) {
    return { title: `Termék nem található – ${SITE_NAME}` }
  }
  const name = getProductName(product, locale)
  const title = `${name} – ${SITE_NAME}`
  const cat = categories.find((c) => c.slug === product.category)
  const categoryName = cat ? getCategoryName(cat, locale) : product.category
  const descText = getProductDescription(product, locale) || ''
  const description =
    descText.slice(0, 155) ||
    `${name}. ${categoryName}. ${product.condition}. ${(product.discountPriceHuf ?? product.priceHuf).toLocaleString('hu-HU')} Ft.`
  const imagePath = product.image?.startsWith('/') ? product.image : '/img/logo.png'
  const imageUrl = imagePath.startsWith('http') ? imagePath : `${BASE_URL}${imagePath}`

  return buildPageMetadata({
    locale,
    title,
    description,
    internalPath: `/termek/${product.slug}`,
    image: imageUrl,
  })
}

export default async function ProductLayout({ params, children }: Props) {
  return <>{children}</>
}
