import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { pageMetadata } from '@/lib/page-metadata'

/** Locale-aware SEO for info pages (cookie / ?lang=). */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? '/'
  const titleKeyByPath: Record<string, string> = {
    '/szallitas': 'seo.shippingTitle',
    '/visszakuldes': 'seo.returnsTitle',
    '/kapcsolat': 'seo.contactTitle',
    '/gyik': 'seo.faqTitle',
  }
  const titleKey = titleKeyByPath[pathname] ?? 'seo.title'
  return pageMetadata(pathname, titleKey)
}

export default function StaticInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
