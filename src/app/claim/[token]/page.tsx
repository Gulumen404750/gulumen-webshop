import type { Metadata } from 'next'
import { GiftPointClaimClient } from './GiftPointClaimClient'

type Props = {
  params: Promise<{ token: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Ajándékpont beváltása | Gulumen',
    robots: { index: false, follow: false },
  }
}

export default async function GiftPointClaimPage({ params }: Props) {
  const { token } = await params
  return <GiftPointClaimClient token={decodeURIComponent(token)} />
}
