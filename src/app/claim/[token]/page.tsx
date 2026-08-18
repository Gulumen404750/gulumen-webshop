import type { Metadata } from 'next'
import { GiftPointClaimClient } from './GiftPointClaimClient'
import { getServerLocale } from '@/lib/locale-server'
import { getTranslations, t } from '@/i18n/translations'

type Props = {
  params: Promise<{ token: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  return {
    title: t(getTranslations(locale), 'seo.giftClaimTitle'),
    robots: { index: false, follow: false },
  }
}

export default async function GiftPointClaimPage({ params }: Props) {
  const { token } = await params
  return <GiftPointClaimClient token={decodeURIComponent(token)} />
}
