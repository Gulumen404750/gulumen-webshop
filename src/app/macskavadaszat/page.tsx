import type { Metadata } from 'next'
import { CatHuntGame } from '@/components/CatHuntGame'
import { getServerLocale } from '@/lib/locale-server'
import { buildLocalizedMetadata, getSiteCopy } from '@/lib/site-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const { catHuntTitle, description } = getSiteCopy(locale)
  return buildLocalizedMetadata({
    pathname: '/macskavadaszat',
    title: catHuntTitle,
    description,
  })
}

export default function MacskavadaszatPage() {
  return <CatHuntGame />
}
