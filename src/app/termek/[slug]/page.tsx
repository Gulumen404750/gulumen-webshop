import { notFound } from 'next/navigation'
import { getProductBySlugAsync } from '@/lib/data'
import { getProductOrdersCount } from '@/lib/orders'
import { ProductPageContent } from './ProductPageContent'

/** Timed oldal: rövid revalidate a saleFrom/saleTo boundary környékén. */
export const revalidate = 5

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

  const serverNow = Date.now()
  return <ProductPageContent product={productWithCount} slug={slug} serverNow={serverNow} />
}
