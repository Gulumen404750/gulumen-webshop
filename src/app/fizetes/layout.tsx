import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/fizetes', 'seo.paymentTitle')
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
