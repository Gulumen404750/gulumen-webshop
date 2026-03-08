import { notFound } from 'next/navigation'
import { getProductBySlugAsync } from '@/lib/data'
import { getProductOrdersCount } from '@/lib/orders'
import { getServerTimeMs } from '@/lib/server-time'
import { ProductPageContent } from './ProductPageContent'

/** Timed oldal: rövid revalidate a készlet és a sale boundary konzisztenciájához. */
export const revalidate = 10

type PageProps = { params: Promise<{ slug: string }> }

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getProductBySlugAsync(slug)
  if (!product) notFound()

  let productWithCount = product
  if (product.type === 'sourcing_deal') {
    const serverOrdersCount = await getProductOrdersCount(product.id)
    productWithCount = { ...product, ordersCount: serverOrdersCount }
  }

  const serverNow = await getServerTimeMs()
  return <ProductPageContent product={productWithCount} slug={slug} serverNow={serverNow} />
}
