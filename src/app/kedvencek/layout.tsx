import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/kedvencek', 'seo.wishlistTitle')
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children
}
