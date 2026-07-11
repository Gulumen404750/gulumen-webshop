import type { Metadata } from 'next'
import { CatHuntGame } from '@/components/CatHuntGame'

export const metadata: Metadata = {
  title: 'Modern Macskavadászat',
}

export default function MacskavadaszatPage() {
  return <CatHuntGame />
}
