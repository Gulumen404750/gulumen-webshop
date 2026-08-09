import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/regisztracio', 'seo.registerTitle')
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
